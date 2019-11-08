# @cumulus/sf-sns-report

Broadcast an incoming Cumulus message to SNS.  This lambda function works with Cumulus Message Adapter, and it can be used anywhere in a step function workflow to report granule and PDR status.

Note that the initial and final reporting of an execution/granule/PDR status is now handled by Cumulus outside of the workflow process, so the use of this task to report start/stop status is deprecated. **This task should only be utilized if an update to status mid-workflow is desired.**

If the task's input includes a `payload` key, the value of the key is returned as the output of the task, otherwise the output will be an empty object.

To report the PDR's progress as it's being processed, add the following step after the pdr-status-check:

```yaml
    PdrStatusReport:
      Parameters:
        cma:
          event.$: '$'
          task_config:
              cumulus_message:
                input: '{$}'
      ResultPath: null
      Type: Task
      Resource: ${SfSnsReportLambdaFunction.Arn}
```


## What is Cumulus?

Cumulus is a cloud-based data ingest, archive, distribution and management prototype for NASA's future Earth science data streams.

[Cumulus Documentation](https://nasa.github.io/cumulus)

## Contributing

See [Cumulus README](https://github.com/nasa/cumulus/blob/master/README.md#installing-and-deploying)