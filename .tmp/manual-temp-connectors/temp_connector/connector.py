from base_connector import BaseConnector, connector_tool


class TempConnector(BaseConnector):
    def __init__(self, token):
        self.token = token

    @connector_tool
    def ping(self):
        return "pong"

    def get_tools(self):
        return [self.ping]
