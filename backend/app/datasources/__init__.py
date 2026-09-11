from app.datasources.dialects.clickhouse import ClickhouseConnector
from app.datasources.dialects.dm import DmConnector
from app.datasources.dialects.doris import DorisConnector
from app.datasources.dialects.elasticsearch import ElasticsearchConnector
from app.datasources.dialects.gaussdb import GaussdbConnector
from app.datasources.dialects.hive import HiveConnector
from app.datasources.dialects.mariadb import MariadbConnector
from app.datasources.dialects.influxdb import InfluxdbConnector
from app.datasources.dialects.mongodb import MongodbConnector
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.dialects.oracle import OracleConnector
from app.datasources.dialects.postgres import PostgresConnector
from app.datasources.dialects.presto import PrestoConnector
from app.datasources.dialects.sqlite import SqliteConnector
from app.datasources.dialects.sqlserver import SqlserverConnector
from app.datasources.dialects.starrocks import StarrocksConnector
from app.datasources.dialects.tdengine import TdengineConnector
from app.datasources.dialects.tidb import TidbConnector
from app.datasources.dialects.timescaledb import TimescaledbConnector
from app.datasources.dialects.trino import TrinoConnector
from app.core.nfr.plugin_extension import register_connector_plugin
from app.datasources.dialects.gbase import GbaseConnector
from app.datasources.dialects.kingbase import KingbaseConnector
from app.datasources.dialects.oceanbase import OceanbaseConnector
from app.datasources.dialects.opensearch import OpensearchConnector
from app.datasources.dialects.rest_api import RestApiConnector
from app.datasources.dialects.excel import ExcelConnector
from app.datasources.dialects.csv_file import CsvFileConnector
from app.datasources.dialects.db2 import Db2Connector
from app.datasources.dialects.impala import ImpalaConnector
from app.datasources.dialects.redshift import RedshiftConnector
from app.datasources.dialects.roapi import RoapiConnector
from app.datasources.registry import register_dialect


def register_builtin_dialects() -> None:
    register_dialect(MysqlConnector())
    register_dialect(PostgresConnector())
    register_dialect(TidbConnector())
    register_dialect(StarrocksConnector())
    register_dialect(ElasticsearchConnector())
    register_dialect(HiveConnector())
    register_dialect(MariadbConnector())
    register_dialect(ClickhouseConnector())
    register_dialect(SqlserverConnector())
    register_dialect(DorisConnector())
    register_dialect(OracleConnector())
    register_dialect(GaussdbConnector())
    register_dialect(DmConnector())
    register_dialect(TrinoConnector())
    register_dialect(PrestoConnector())
    register_dialect(MongodbConnector())
    register_dialect(InfluxdbConnector())
    register_dialect(TdengineConnector())
    register_dialect(SqliteConnector())
    register_dialect(TimescaledbConnector())
    register_connector_plugin(GbaseConnector())
    register_connector_plugin(OceanbaseConnector())
    register_connector_plugin(OpensearchConnector())
    register_connector_plugin(KingbaseConnector())
    register_dialect(RestApiConnector())
    register_dialect(ExcelConnector())
    register_dialect(CsvFileConnector())
    register_dialect(Db2Connector())
    register_dialect(ImpalaConnector())
    register_dialect(RedshiftConnector())
    register_dialect(RoapiConnector())


register_builtin_dialects()
