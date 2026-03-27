#
# Copyright (c) 2025 IBM Corp.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import httpx
import json
import os

from typing import Any
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("mqmcpserver", host = "0.0.0.0", port=8000)

# Load environment variables from .env file if present.
load_dotenv()

# Set these in .env (or as environment variables).
URL_BASE = os.getenv("URL_BASE", "")
USER_NAME = os.getenv("USER_NAME", "")
PASSWORD = os.getenv("PASSWORD", "")
LOGS_URL = os.getenv("LOGS_URL", "")
SSH_URL = os.getenv("SSH_URL", "")

@mcp.tool()
async def dspmq() -> str:
    """List available queue managers and whether they are running or not
    """
    headers = {
        "Content-Type": "application/json",
        "ibm-mq-rest-csrf-token": "token"
    }    
    
    url = URL_BASE + "qmgr/"

    auth = httpx.BasicAuth(username=USER_NAME, password=PASSWORD)
    async with httpx.AsyncClient(verify=False,auth=auth) as client:
        try:            
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return prettify_dspmq(response.content)
        except Exception as err:
            print(err)
            return "Something went wrong!"
                        
# Put the output of for each queue manager on its own line, separated by ---                        
def prettify_dspmq(payload: str) -> str:
    jsonOutput = json.loads(payload.decode("utf-8"))
    prettifiedOutput="\n---\n"
    for x in jsonOutput['qmgr']:
      prettifiedOutput += "name = " + x['name'] + ", running = " + x['state'] + "\n---\n"
    
    return prettifiedOutput
    
@mcp.tool()
async def runmqsc(qmgr_name: str, mqsc_command: str) -> str:
    """Run an MQSC command against a specific queue manager

    Args:
        qmgr_name: A queue manager name   
        mqsc_command: An MQSC command to run on the queue manager   
    """
    headers = {
        "Content-Type": "application/json",
        "ibm-mq-rest-csrf-token": "a"
    }
    
    data = "{\"type\":\"runCommand\",\"parameters\":{\"command\":\"" + mqsc_command + "\"}}"
    
    url = URL_BASE + "action/qmgr/" + qmgr_name + "/mqsc"

    auth = httpx.BasicAuth(username=USER_NAME, password=PASSWORD)
    async with httpx.AsyncClient(verify=False,auth=auth) as client:
        try:            
            response = await client.post(url, data=data, headers=headers, timeout=30.0)
            response.raise_for_status()
            return prettify_runmqsc(response.content)
        except Exception as err:
            print(err)
            return "Something went wrong!"
            
# Put the output of each MQSC command on its own line, separated by ---
# Deals with both z/OS and distributed queue managers
def prettify_runmqsc(payload: str) -> str:
    jsonOutput = json.loads(payload.decode("utf-8"))
    prettifiedOutput="\n---\n"
    for x in jsonOutput['commandResponse']:
        # z/OS
        if x['text'][0].startswith("CSQN205I"):
            # Remove leading and trailing messages, as they aren't needed. 
            x['text'].pop(0)            
            x['text'].pop()
            for y in x['text']:
                prettifiedOutput += y[15:] + "\n---\n"            
        # Distributed
        else:        
            prettifiedOutput += x['text'][0] + "\n---\n"   
    
    return prettifiedOutput    

@mcp.tool()
async def get_mq_logs() -> str:
    """This tool returns IBM MQ error logs and reports any detected MQ issues such as channel failures or connectivity errors."""
    if not LOGS_URL:
        return "LOGS_URL is not configured."

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(LOGS_URL, timeout=30.0)
            response.raise_for_status()
            return prettify_mq_logs(response.json())
        except Exception as err:
            print(err)
            return "Failed to fetch MQ logs."


def prettify_mq_logs(payload: Any) -> str:
    if not isinstance(payload, dict):
        return json.dumps(payload, indent=2)

    prettified_output = "\n---\n"
    prettified_output += "status = " + str(payload.get("status", "UNKNOWN")) + "\n"
    prettified_output += "message = " + str(payload.get("message", "")) + "\n"

    errors = payload.get("errors", [])
    if errors:
        prettified_output += "detected_issues =\n"
        for error in errors:
            if isinstance(error, str):
                prettified_output += error + "\n"
            else:
                prettified_output += json.dumps(error, ensure_ascii=True) + "\n"
    else:
        prettified_output += "detected_issues = none\n"

    prettified_output += "---\n"
    return prettified_output


@mcp.tool()
async def run_commands_ssh(command: str) -> str:
    """This tool is connected with an endpoint which sshs into the server where QManagers are running. Only run those commands which are mentioned in the system instructions.

    Args:
        command: The command string passed by the agent at runtime.
    """
    if not SSH_URL:
        return "SSH_URL is not configured."

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                SSH_URL,
                json={"command": command},
                timeout=60.0,
            )
            response.raise_for_status()
            return prettify_ssh_response(response.json())
        except Exception as err:
            print(err)
            return "Failed to run SSH command."


def prettify_ssh_response(payload: Any) -> str:
    if not isinstance(payload, dict):
        return json.dumps(payload, indent=2)

    prettified_output = "\n---\n"

    output = payload.get("output", "")
    error = payload.get("error", "")

    if output:
        prettified_output += "output =\n" + str(output).rstrip() + "\n"
    else:
        prettified_output += "output =\n<empty>\n"

    if error:
        prettified_output += "---\nerror =\n" + str(error).rstrip() + "\n"
    else:
        prettified_output += "---\nerror =\n<empty>\n"

    prettified_output += "---\n"
    return prettified_output

if __name__ == "__main__":
    mcp.run(transport='streamable-http')
    # If using IBM Bob then use one of these
    #mcp.run(transport='stdio')
    # URL is http://127.0.0.1:8000/sse
    #mcp.run(transport='sse')
