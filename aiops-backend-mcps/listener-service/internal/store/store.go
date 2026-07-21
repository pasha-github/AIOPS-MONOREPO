// Package store is the embedded BoltDB persistence: a cache of the last-known-good
// listener config (so consumers resume on restart even if AIOps is down), a
// dead-letter store, and per-listener delivery metrics.
package store

import (
	"encoding/binary"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	bolt "go.etcd.io/bbolt"
	bolterrors "go.etcd.io/bbolt/errors"

	"listener-service/internal/model"
)

func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0o755)
}

var (
	bucketConfig  = []byte("config")
	bucketDead    = []byte("deadletter")
	bucketMetrics = []byte("metrics")
)

type Store struct {
	db *bolt.DB
}

// Open opens (creating if needed) the BoltDB file and ensures the buckets exist.
func Open(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := ensureDir(dir); err != nil {
			return nil, err
		}
	}
	db, err := bolt.Open(path, 0o600, &bolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, err
	}
	err = db.Update(func(tx *bolt.Tx) error {
		for _, name := range [][]byte{bucketConfig, bucketDead, bucketMetrics} {
			if _, err := tx.CreateBucketIfNotExists(name); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

// SaveSpecs replaces the cached config set with the given specs.
func (s *Store) SaveSpecs(specs []model.ListenerSpec) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		if err := tx.DeleteBucket(bucketConfig); err != nil && err != bolterrors.ErrBucketNotFound {
			return err
		}
		b, err := tx.CreateBucket(bucketConfig)
		if err != nil {
			return err
		}
		for _, spec := range specs {
			data, err := json.Marshal(spec)
			if err != nil {
				return err
			}
			if err := b.Put([]byte(spec.ListenerID), data); err != nil {
				return err
			}
		}
		return nil
	})
}

// LoadSpecs returns the cached config set.
func (s *Store) LoadSpecs() ([]model.ListenerSpec, error) {
	var out []model.ListenerSpec
	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketConfig)
		if b == nil {
			return nil
		}
		return b.ForEach(func(_, v []byte) error {
			var spec model.ListenerSpec
			if err := json.Unmarshal(v, &spec); err != nil {
				return err
			}
			out = append(out, spec)
			return nil
		})
	})
	return out, err
}

// DeadLetter records an undeliverable message under the listener's sub-bucket.
func (s *Store) DeadLetter(listenerID, message string, meta map[string]string, errStr string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		root := tx.Bucket(bucketDead)
		sub, err := root.CreateBucketIfNotExists([]byte(listenerID))
		if err != nil {
			return err
		}
		seq, err := sub.NextSequence()
		if err != nil {
			return err
		}
		rec := model.DeadLetterRecord{Seq: seq, Message: message, Metadata: meta, Error: errStr}
		data, err := json.Marshal(rec)
		if err != nil {
			return err
		}
		return sub.Put(itob(seq), data)
	})
}

// ListDeadLetter returns all dead-lettered records for a listener.
func (s *Store) ListDeadLetter(listenerID string) ([]model.DeadLetterRecord, error) {
	out := []model.DeadLetterRecord{}
	err := s.db.View(func(tx *bolt.Tx) error {
		root := tx.Bucket(bucketDead)
		if root == nil {
			return nil
		}
		sub := root.Bucket([]byte(listenerID))
		if sub == nil {
			return nil
		}
		return sub.ForEach(func(_, v []byte) error {
			var rec model.DeadLetterRecord
			if err := json.Unmarshal(v, &rec); err != nil {
				return err
			}
			out = append(out, rec)
			return nil
		})
	})
	return out, err
}

// Incr increments a per-listener counter (received/delivered/dead_lettered).
func (s *Store) Incr(listenerID, counter string) error {
	key := []byte(listenerID + ":" + counter)
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketMetrics)
		n := btoi(b.Get(key))
		return b.Put(key, itob(n+1))
	})
}

// Metrics returns the counters for a listener.
func (s *Store) Metrics(listenerID string) (map[string]uint64, error) {
	out := map[string]uint64{}
	prefix := listenerID + ":"
	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketMetrics)
		if b == nil {
			return nil
		}
		return b.ForEach(func(k, v []byte) error {
			key := string(k)
			if strings.HasPrefix(key, prefix) {
				out[strings.TrimPrefix(key, prefix)] = btoi(v)
			}
			return nil
		})
	})
	return out, err
}

func itob(v uint64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, v)
	return b
}

func btoi(b []byte) uint64 {
	if len(b) < 8 {
		return 0
	}
	return binary.BigEndian.Uint64(b)
}
