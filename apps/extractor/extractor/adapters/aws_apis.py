from dataclasses import dataclass

from extractor.adapters.account_controls_api import AccountControlsApi
from extractor.adapters.autoscaling_api import AutoscalingApi
from extractor.adapters.aws_clients import AwsClients
from extractor.adapters.cloudwatch_api import CloudwatchApi
from extractor.adapters.dynamodb_api import DynamodbApi
from extractor.adapters.ec2_api import Ec2Api
from extractor.adapters.ecr_api import EcrApi
from extractor.adapters.ecs_api import EcsApi
from extractor.adapters.efs_api import EfsApi
from extractor.adapters.eks_api import EksApi
from extractor.adapters.elasticache_api import ElasticacheApi
from extractor.adapters.elb_api import ElbApi
from extractor.adapters.events_api import EventsApi
from extractor.adapters.firehose_api import FirehoseApi
from extractor.adapters.iam_api import IamApi
from extractor.adapters.kinesis_api import KinesisApi
from extractor.adapters.lambda_api import LambdaApi
from extractor.adapters.rds_api import RdsApi
from extractor.adapters.route53_api import Route53Api
from extractor.adapters.s3_api import S3Api
from extractor.adapters.sns_api import SnsApi
from extractor.adapters.sqs_api import SqsApi
from extractor.adapters.tagging_api import TaggingApi


@dataclass
class AwsApis:
    ec2: Ec2Api
    eks: EksApi
    ecs: EcsApi
    elb: ElbApi
    autoscaling: AutoscalingApi
    rds: RdsApi
    elasticache: ElasticacheApi
    dynamodb: DynamodbApi
    s3: S3Api
    efs: EfsApi
    sqs: SqsApi
    sns: SnsApi
    kinesis: KinesisApi
    firehose: FirehoseApi
    lambdas: LambdaApi
    events: EventsApi
    route53: Route53Api
    iam: IamApi
    ecr: EcrApi
    cloudwatch: CloudwatchApi
    controls: AccountControlsApi
    tagging: TaggingApi | None = None


def connect(endpoint, region, access_key_id, secret_access_key):
    clients = AwsClients(endpoint, region, access_key_id, secret_access_key)
    c = clients.client
    return AwsApis(ec2=Ec2Api(c("ec2")), eks=EksApi(c("eks")), ecs=EcsApi(c("ecs")), elb=ElbApi(c("elbv2")),
                   autoscaling=AutoscalingApi(c("autoscaling")), rds=RdsApi(c("rds")), elasticache=ElasticacheApi(c("elasticache")),
                   dynamodb=DynamodbApi(c("dynamodb")), s3=S3Api(c("s3")), efs=EfsApi(c("efs")), sqs=SqsApi(c("sqs")),
                   sns=SnsApi(c("sns")), kinesis=KinesisApi(c("kinesis")), firehose=FirehoseApi(c("firehose")),
                   lambdas=LambdaApi(c("lambda")), events=EventsApi(c("events")), route53=Route53Api(c("route53")),
                   iam=IamApi(c("iam")), ecr=EcrApi(c("ecr")), cloudwatch=CloudwatchApi(c("cloudwatch")),
                   controls=AccountControlsApi(clients), tagging=TaggingApi(c("resourcegroupstaggingapi")))
