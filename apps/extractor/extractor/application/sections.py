from extractor.application.extract_cache import extract_cache
from extractor.application.extract_compute import extract_compute
from extractor.application.extract_dynamodb import extract_dynamodb
from extractor.application.extract_ecs import extract_ecs
from extractor.application.extract_efs import extract_efs
from extractor.application.extract_eks import extract_eks
from extractor.application.extract_lambda import extract_lambda
from extractor.application.extract_messaging import extract_messaging
from extractor.application.extract_network_edge import extract_network_edge
from extractor.application.extract_rds import extract_rds
from extractor.application.extract_s3 import extract_s3

SECTIONS = (("x_eks", extract_eks), ("x_ecs", extract_ecs), ("x_ec2_asg", extract_compute), ("x_rds", extract_rds),
            ("x_cache", extract_cache), ("x_dynamo", extract_dynamodb), ("x_s3", extract_s3), ("x_efs", extract_efs),
            ("x_messaging", extract_messaging), ("x_lambda", extract_lambda), ("x_network_edge", extract_network_edge))
