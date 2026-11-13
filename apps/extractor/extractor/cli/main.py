from extractor import settings
from extractor.adapters.aws_apis import connect
from extractor.application.run_extraction import ExtractionRequest, run_extraction
from extractor.cli.arguments import parse_arguments
from extractor.cli.extension_sources import extension_sources
from extractor.cli.output import write_document
from extractor.cli.summary import summary_lines


def main(argv=None):
    aws_settings = settings.aws()
    arguments = parse_arguments(aws_settings, argv)
    aws = connect(arguments.endpoint, arguments.region, aws_settings.access_key_id, aws_settings.secret_access_key)
    request = ExtractionRequest(arguments.endpoint, arguments.region, arguments.project, arguments.window_days)
    sources = extension_sources(settings.extensions()) if arguments.extensions else None
    document = run_extraction(request, aws, sources)
    path = write_document(arguments.out, document)
    print("\n".join(summary_lines(path, document)))
