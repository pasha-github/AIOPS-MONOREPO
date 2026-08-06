package com.rc.aroyacruise.query;


import java.util.Map;

public class NodeHomePageVoyagesQuery implements AroyaQuery {

    private static final String DEFAULT_LOCALE = "en";
    private static final String DEFAULT_SITE = "website";


    @Override
    public String query() {
        return """
                query HomePageVoyages($locale: Locale!, $site: Site) {
                  homePageVoyages(locale: $locale, site: $site) {
                    destination
                    voyages {
                      reference
                      inventoryResult
                      pkg {
                        key
                        id
                        name
                        destination
                        description
                        isActive
                        landDays
                        sailDays
                        sailCode
                        sailIdent
                        season
                        initialStatus
                        comment
                        typeName
                        typeComment
                        active
                        type {
                          code
                          key
                          name
                          comments
                          landDays
                          sailDays
                          active
                          attributes {
                            code
                            name
                            type
                            comments
                          }
                          cms {
                            id
                            documentId
                            title
                            duration
                            pkg_media
                            pkg_media_list {
                              id
                              documentId
                              name
                              alternativeText
                              caption
                              width
                              height
                              formats
                              hash
                              ext
                              mime
                              size
                              url
                              previewUrl
                              provider
                              provider_metadata
                              createdAt
                              updatedAt
                              publishedAt
                            }
                            map_image {
                              id
                              documentId
                              name
                              alternativeText
                              caption
                              width
                              height
                              formats
                              hash
                              ext
                              mime
                              size
                              url
                              previewUrl
                              provider
                              provider_metadata
                              createdAt
                              updatedAt
                              publishedAt
                            }
                            description
                            destination
                            departure
                            arrival
                            pkg_code
                            isThematic
                            has_voyage_info
                            voyage_info
                            createdAt
                            updatedAt
                            publishedAt
                          }
                        }
                        productType {
                          key
                          daily
                          comments
                        }
                        classifications {
                          code
                          type
                          dateRange {
                            from
                            to
                          }
                          comments
                        }
                      }
                      availableCategories {
                        sharedOccupancy
                        sharedGenders
                        rank
                        capacity
                        maxAvailableCapacity
                        hasRollAway
                        description
                        inGroup
                        groupEffectiveDate
                        childBeds
                        availabilityResult
                        rollAwayAvailabilityResult
                        canBookCabins
                        canBookNestedCabins
                        reference
                        guestDistribution {
                          cabinSeqN
                          guests
                        }
                        cabinCategory {
                          keys
                          key
                          id
                          code
                          description
                          comments
                          cabinCapacity
                          categoryCapacity
                          rank
                        }
                        availability {
                          result
                          shipResult
                          totalCabins
                          availableCabins
                          reserved
                          availableReserved
                          totalAvailableAbsolute
                          totalAvailableWeighted
                        }
                        price {
                          currency {
                            key
                            id
                          }
                          total
                          pricePerGuest {
                            total
                            discount
                            quoteTotal
                          }
                          discount
                          quoteTotal
                          quoteDiscount
                        }
                        addons {
                          price
                          addon {
                            keys
                            key
                            id
                            name
                            useAsClientPreference
                            active
                            manualPrice
                            comments
                            provider
                            initialStatus
                            couponClass
                            dynamicFields
                            linkedClubLevel
                            category {
                              key
                              comments
                            }
                            type {
                              key
                              active
                            }
                          }
                          guests {
                            description
                            name
                            reference
                            componentKind
                            seqN
                            guestId
                            age
                            gender
                            seating
                            secretCode
                            amountDue
                            parentGuestSeqN
                            insurance
                            voyagesCount
                          }
                          promotion {
                            key
                            id
                            type
                            group
                            code
                            name
                            active
                          }
                        }
                        cmsCabin {
                          description
                          virtual_image
                          cabinCategoryPage {
                            page_slug
                            page_title
                          }
                          title
                          cabinTypeDescription
                          description_1
                          description_2
                          contentDescription
                          media {
                            id
                            name
                            alternativeText
                            caption
                            width
                            height
                            url
                            formats
                          }
                        }
                      }
                      sailActivities {
                        keys
                        id
                        recordId
                        key
                        sailActivityId
                        sailRefId
                        sailRefIdent
                        dateTime
                        dressCode
                        mayEmbark
                        mayDisembark
                        portCode
                        description
                        comments
                        notes
                        ownership
                        paxStatus
                        cargoStatus
                        dateTimeWithTZ
                        tenderMode
                        itineraryTitle
                        itineraryDescription
                        type {
                          key
                          comments
                        }
                        port {
                          key
                          name
                        }
                      }
                      sail {
                        timePrecision
                        route {
                          id
                          key
                          code
                          comments
                        }
                        ship {
                          key
                          id
                          locationType
                          code
                          name
                        }
                        from {
                          dateTime
                          sailRefID
                          sailRefIdent
                          port {
                            keys
                            key
                            id
                            locationType
                            code
                            name
                            tenderMode
                            comments
                            notes
                          }
                        }
                        to {
                          dateTime
                          sailRefID
                          sailRefIdent
                        }
                      }
                    }
                  }
                }
                """;
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of(
                "locale", DEFAULT_LOCALE,
                "site", DEFAULT_SITE
        );
    }
}