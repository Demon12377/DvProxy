# Batch API

Source: https://ai.google.dev/api/batch-api

==================



  
    
    The Gemini API supports batch APIs, which let you process multiple requests in a single call. For more details, see the Batch API guide.

    @media screen and (max-width: 2099px) {
        devsite-toc.devsite-toc,devsite-toc[visible].devsite-toc {
            display:none
        }
        devsite-toc.devsite-toc-embedded:not(:empty) {
            display: block;
            margin: 28px 0 24px
        }
        body[layout][concierge] devsite-toc.devsite-toc-embedded {
            display: none
        }
        devsite-toc.devsite-toc-embedded:not(:empty)~.devsite-article-body>:first-child {
            margin-top: 0
        }
        body[template=landing] devsite-toc.devsite-toc-embedded:not(:empty) {
            margin: 20px 40px 24px
        }
    }

    body[layout=docs] .devsite-main-content[has-book-nav],
    body[layout=docs] .devsite-main-content[has-book-nav][has-sidebar],
    body[layout=docs][concierge] .devsite-main-content[has-book-nav],
    body[layout=docs][concierge] .devsite-main-content[has-book-nav][has-sidebar] {
        grid-template-columns: minmax(269px, 1fr) minmax(365px, 1600px) 1fr;
    }
    body[layout=docs] devsite-content,
    body[layout=docs][concierge] devsite-content {
        width: 100%;
        max-width: 1600px;
    }
    .prototype {
      code {
        padding: 0;
        word-break: break-all;
      }
      devsite-selector {
        font-size: 0.9rem;
        devsite-tabs tab > a {
          font-size: 0.9rem;
        }
        devsite-selector {
          margin: 12px -23px 0;
        }
      }
      devsite-code pre {
        margin: 0;
        padding-block: 12px;
        padding-inline: 12px;
        max-height: 600px;
        font-size: 0.8rem;
        code {
          font-size: 0.8rem;
        }
      }
      devsite-code .devsite-code-buttons-container + pre {
        padding-block: var(--devsite-code-button-size, 24px) 0;
      }
      .endpoint {
        display: inline-flex;
        flex-wrap: nowrap;
        flex-direction: row;
        align-items: baseline;
        justify-content: flex-start;
        column-gap: 12px;

        padding: 4px 8px;
        color: var(--devsite-ref-palette--grey800, #3c4043);
        background: var(--devsite-code-background, #f1f3f4);
        border: 1px solid var(--devsite-ref-palette--grey500, #9aa0a6);
        border-radius: 4px;

        /* Sys > Typography > Core Composites - Desktop/Overline-s */
        font-family: Roboto;
        font-size: 14px;
        font-style: normal;
        font-weight: 500;
        line-height: 16px; /* 145.455% */
        letter-spacing: 0.8px;

        .http-method {
          color: var(--devsite-ref-palette--green600, #1e8e3e);
          font-size: 12px;
          text-transform: uppercase;
        }

        .endpoint-url {
          display: inline-block;
        }
      }
      .field-entry {
        display: flex;
        flex-direction: column;
        align-items: initial;
        justify-content: initial;
        overflow: hidden;
        margin: 24px 0 0 12px;
        p {
          margin: 0;
          font-family: Roboto;
          font-size: 14px;
          font-style: normal;
          font-weight: 400;
          line-height: 20px; /* 166.667% */
        }
        .signature {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: initial;
          overflow: hidden;
          column-gap: 12px;
          row-gap: 0;
          .field-name {
            display: inline-block;
            padding-block: 2px;
            padding-inline: 0;
            font-weight: 500;
          }
          .field-type {
            display: inline-block;
            padding-block: 2px;
            padding-inline: 0;
            opacity: 0.85;
            font-size: 0.9em;
          }
          .field-nessesity {
              display: inline-block;
              padding: 2px 0;
              &.required {
                color: red;
              }
              &.optional {
                color: rgba(0, 0, 0, 0.66);
              }
            }
          }
        .field-description {
            display: inline-block;
            margin-top: 4px;
        }
        &.union-type {
          .union-type-preamble {
              display: flex;
              flex-direction: column;
              align-items: initial;
              justify-content: initial;
              row-gap: 12px;
          }
          /* nested field-entry styles */
          .field-entry {
              border-left: solid 1px #a8a8a8;
              padding-inline: 12px 0;
          }
        }
      }
      .column-container {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: initial;
        justify-content: initial;
        max-width: 1600px;
        gap: 0 24px;
        .reference {
          flex: 1 1 0;
          min-width: 400px;
        }
        .second-column {
          flex: 1 1 0;
          min-width: 350px;
          max-width: 600px;
          position: sticky;
          top: var(--devsite-js-header-height, 110px);
          height: 100%;
        }
      }
    }
    Method: models.batchGenerateContent




EndpointPath parametersRequest body

JSON representation

JSON representationJSON representationJSON representation



Response bodyAuthorization scopes




Enqueues a batch of models.generateContent requests for batch processing.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{batch.model=models/*}:batchGenerateContent








Path parameters




batch.model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}. It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






batch.name


string



Output only. Identifier. Resource name of the batch.Format: batches/{batchId}.







batch.displayName


string



Required. The user-defined name of this batch.







batch.inputConfig


object (InputConfig)



Required. Input configuration of the instances on which batch processing are performed.







batch.output


object (GenerateContentBatchOutput)



Output only. The output of the batch request.







batch.createTime


string (Timestamp format)



Output only. The time at which the batch was created.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







batch.endTime


string (Timestamp format)



Output only. The time at which the batch processing completed.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







batch.updateTime


string (Timestamp format)



Output only. The time at which the batch was last updated.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







batch.batchStats


object (BatchStats)



Output only. Stats about the batch.







batch.state


enum (BatchState)



Output only. The state of the batch.







batch.priority


string (int64 format)



Optional. The priority of the batch. Batches with a higher priority value will be processed before batches with a lower priority value. Negative values are allowed. Default is 0.










Response body
If successful, the response body contains an instance of Operation.




Method: models.asyncBatchEmbedContent




EndpointPath parametersRequest body

JSON representation

JSON representationJSON representationJSON representation



Response bodyAuthorization scopes




Enqueues a batch of models.embedContent requests for batch processing. We have a models.batchEmbedContents handler in GenerativeService, but it was synchronized. So we name this one to be Async to avoid confusion.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{batch.model=models/*}:asyncBatchEmbedContent








Path parameters




batch.model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}. It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






batch.name


string



Output only. Identifier. Resource name of the batch.Format: batches/{batchId}.







batch.displayName


string



Required. The user-defined name of this batch.







batch.inputConfig


object (InputEmbedContentConfig)



Required. Input configuration of the instances on which batch processing are performed.







batch.output


object (EmbedContentBatchOutput)



Output only. The output of the batch request.







batch.createTime


string (Timestamp format)



Output only. The time at which the batch was created.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







batch.endTime


string (Timestamp format)



Output only. The time at which the batch processing completed.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







batch.updateTime


string (Timestamp format)



Output only. The time at which the batch was last updated.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







batch.batchStats


object (EmbedContentBatchStats)



Output only. Stats about the batch.







batch.state


enum (BatchState)



Output only. The state of the batch.







batch.priority


string (int64 format)



Optional. The priority of the batch. Batches with a higher priority value will be processed before batches with a lower priority value. Negative values are allowed. Default is 0.










Response body
If successful, the response body contains an instance of Operation.




Method: batches.get




EndpointPath parametersRequest bodyResponse bodyAuthorization scopes


Gets the latest state of a long-running operation. Clients can use this method to poll the operation result at intervals as recommended by the API service.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=batches/*}








Path parameters




name


string



The name of the operation resource. It takes the form batches/{batches}.





Request body
The request body must be empty.






Response body
If successful, the response body contains an instance of Operation.




Method: batches.list




EndpointPath parametersQuery parametersRequest bodyResponse bodyAuthorization scopes


Lists operations that match the specified filter in the request. If the server doesn't support this method, it returns UNIMPLEMENTED.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=batches}








Path parameters




name


string



The name of the operation's parent resource. It takes the form batches.





Query parameters




filter


string



The standard list filter.







pageSize


integer



The standard list page size.







pageToken


string



The standard list page token.







returnPartialSuccess


boolean



When set to true, operations that are reachable are returned as normal, and those that are unreachable are returned in the ListOperationsResponse.unreachable field.This can only be true when reading across collections. For example, when parent is set to "projects/example/locations/-".This field is not supported by default and will result in an UNIMPLEMENTED error if set unless explicitly documented otherwise in service or product specific documentation.





Request body
The request body must be empty.






Response body
If successful, the response body contains an instance of ListOperationsResponse.




Method: batches.cancel




EndpointPath parametersRequest bodyResponse bodyAuthorization scopes


Starts asynchronous cancellation on a long-running operation. The server makes a best effort to cancel the operation, but success is not guaranteed. If the server doesn't support this method, it returns google.rpc.Code.UNIMPLEMENTED. Clients can use Operations.GetOperation or other methods to check whether the cancellation succeeded or whether the operation completed despite cancellation. On successful cancellation, the operation is not deleted; instead, it becomes an operation with an Operation.error value with a google.rpc.Status.code of 1, corresponding to Code.CANCELLED.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{name=batches/*}:cancel








Path parameters




name


string



The name of the operation resource to be cancelled. It takes the form batches/{batches}.





Request body
The request body must be empty.






Response body
If successful, the response body is an empty JSON object.




Method: batches.delete




EndpointPath parametersRequest bodyResponse bodyAuthorization scopes


Deletes a long-running operation. This method indicates that the client is no longer interested in the operation result. It does not cancel the operation. If the server doesn't support this method, it returns google.rpc.Code.UNIMPLEMENTED.




Endpoint


                delete
              

https://generativelanguage.googleapis.com/v1beta/{name=batches/*}








Path parameters




name


string



The name of the operation resource to be deleted. It takes the form batches/{batches}.





Request body
The request body must be empty.






Response body
If successful, the response body is an empty JSON object.




GenerateContentBatch




JSON representationInputConfig

JSON representation

InlinedRequests

JSON representation

InlinedRequest

JSON representation

GenerateContentBatchOutput

JSON representation

InlinedResponses

JSON representation

InlinedResponse

JSON representation

BatchStats

JSON representation






A resource representing a batch of GenerateContent requests.




Fields






model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}.







name


string



Output only. Identifier. Resource name of the batch.Format: batches/{batchId}.







displayName


string



Required. The user-defined name of this batch.







inputConfig


object (InputConfig)



Required. Input configuration of the instances on which batch processing are performed.







output


object (GenerateContentBatchOutput)



Output only. The output of the batch request.







createTime


string (Timestamp format)



Output only. The time at which the batch was created.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







endTime


string (Timestamp format)



Output only. The time at which the batch processing completed.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







updateTime


string (Timestamp format)



Output only. The time at which the batch was last updated.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







batchStats


object (BatchStats)



Output only. Stats about the batch.







state


enum (BatchState)



Output only. The state of the batch.







priority


string (int64 format)



Optional. The priority of the batch. Batches with a higher priority value will be processed before batches with a lower priority value. Negative values are allowed. Default is 0.










JSON representation




{
  "model": string,
  "name": string,
  "displayName": string,
  "inputConfig": {
    object (InputConfig)
  },
  "output": {
    object (GenerateContentBatchOutput)
  },
  "createTime": string,
  "endTime": string,
  "updateTime": string,
  "batchStats": {
    object (BatchStats)
  },
  "state": enum (BatchState),
  "priority": string
}






InputConfig



Configures the input to the batch request.




Fields






source


Union type



Required. The source of the input. source can be only one of the following:




fileName


string



The name of the File containing the input requests.







requests


object (InlinedRequests)



The requests to be processed in the batch.













JSON representation




{

  // source
  "fileName": string,
  "requests": {
    object (InlinedRequests)
  }
  // Union type
}






InlinedRequests



The requests to be processed in the batch if provided as part of the batch creation request.




Fields






requests[]


object (InlinedRequest)



Required. The requests to be processed in the batch.










JSON representation




{
  "requests": [
    {
      object (InlinedRequest)
    }
  ]
}






InlinedRequest



The request to be processed in the batch.




Fields






request


object (GenerateContentRequest)



Required. The request to be processed in the batch.







metadata


object (Struct format)



Optional. The metadata to be associated with the request.










JSON representation




{
  "request": {
    object (GenerateContentRequest)
  },
  "metadata": {
    object
  }
}






GenerateContentBatchOutput



The output of a batch request. This is returned in the BatchGenerateContentResponse or the GenerateContentBatch.output field.




Fields






output


Union type



The output of the batch request. output can be only one of the following:




responsesFile


string



Output only. The file ID of the file containing the responses. The file will be a JSONL file with a single response per line. The responses will be GenerateContentResponse messages formatted as JSON. The responses will be written in the same order as the input requests.







inlinedResponses


object (InlinedResponses)



Output only. The responses to the requests in the batch. Returned when the batch was built using inlined requests. The responses will be in the same order as the input requests.













JSON representation




{

  // output
  "responsesFile": string,
  "inlinedResponses": {
    object (InlinedResponses)
  }
  // Union type
}






InlinedResponses



The responses to the requests in the batch.




Fields






inlinedResponses[]


object (InlinedResponse)



Output only. The responses to the requests in the batch.










JSON representation




{
  "inlinedResponses": [
    {
      object (InlinedResponse)
    }
  ]
}






InlinedResponse



The response to a single request in the batch.




Fields






metadata


object (Struct format)



Output only. The metadata associated with the request.







output


Union type



The output of the request. output can be only one of the following:




error


object (Status)



Output only. The error encountered while processing the request.







response


object (GenerateContentResponse)



Output only. The response to the request.













JSON representation




{
  "metadata": {
    object
  },

  // output
  "error": {
    object (Status)
  },
  "response": {
    object (GenerateContentResponse)
  }
  // Union type
}






BatchStats



Stats about the batch.




Fields






requestCount


string (int64 format)



Output only. The number of requests in the batch.







successfulRequestCount


string (int64 format)



Output only. The number of requests that were successfully processed.







failedRequestCount


string (int64 format)



Output only. The number of requests that failed to be processed.







pendingRequestCount


string (int64 format)



Output only. The number of requests that are still pending processing.










JSON representation




{
  "requestCount": string,
  "successfulRequestCount": string,
  "failedRequestCount": string,
  "pendingRequestCount": string
}







Method: batches.updateEmbedContentBatch




EndpointPath parametersQuery parametersRequest bodyResponse bodyAuthorization scopesEmbedContentRequest

JSON representation






Updates a batch of EmbedContent requests for batch processing.




Endpoint


                patch
              

https://generativelanguage.googleapis.com/v1beta/{embedContentBatch.name=batches/*}:updateEmbedContentBatch




PATCH https://generativelanguage.googleapis.com/v1beta/{embedContentBatch.name=batches/*}:updateEmbedContentBatch



Path parameters




embedContentBatch.name


string



Output only. Identifier. Resource name of the batch.Format: batches/{batchId}. It takes the form batches/{batches}.





Query parameters




updateMask


string (FieldMask format)



Optional. The list of fields to update.This is a comma-separated list of fully qualified names of fields. Example: "user.displayName,photo".





Request body
The request body contains an instance of EmbedContentBatch.



Fields






model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}.







displayName


string



Required. The user-defined name of this batch.







inputConfig


object (InputEmbedContentConfig)



Required. Input configuration of the instances on which batch processing are performed.







priority


string (int64 format)



Optional. The priority of the batch. Batches with a higher priority value will be processed before batches with a lower priority value. Negative values are allowed. Default is 0.









Response body
If successful, the response body contains an instance of EmbedContentBatch.




EmbedContentRequest



Request containing the Content for the model to embed.




Fields






model


string



Required. The model's resource name. This serves as an ID for the Model to use.This name should match a model name returned by the ListModels method.Format: models/{model}







content


object (Content)



Required. The content to embed. Only the parts.text fields will be counted.







taskType


enum (TaskType)



Optional. Optional task type for which the embeddings will be used. Not supported on earlier models (models/embedding-001).







title


string



Optional. An optional title for the text. Only applicable when TaskType is RETRIEVAL_DOCUMENT.Note: Specifying a title for RETRIEVAL_DOCUMENT provides better quality embeddings for retrieval.







outputDimensionality


integer



Optional. Optional reduced dimension for the output embedding. If set, excessive values in the output embedding are truncated from the end. Supported by newer models since 2024 only. You cannot set this value if using the earlier model (models/embedding-001).










JSON representation




{
  "model": string,
  "content": {
    object (Content)
  },
  "taskType": enum (TaskType),
  "title": string,
  "outputDimensionality": integer
}








Method: batches.updateGenerateContentBatch




EndpointPath parametersQuery parametersRequest bodyResponse bodyAuthorization scopesGenerateContentRequest

JSON representation






Updates a batch of GenerateContent requests for batch processing.




Endpoint


                patch
              

https://generativelanguage.googleapis.com/v1beta/{generateContentBatch.name=batches/*}:updateGenerateContentBatch




PATCH https://generativelanguage.googleapis.com/v1beta/{generateContentBatch.name=batches/*}:updateGenerateContentBatch



Path parameters




generateContentBatch.name


string



Output only. Identifier. Resource name of the batch.Format: batches/{batchId}. It takes the form batches/{batches}.





Query parameters




updateMask


string (FieldMask format)



Optional. The list of fields to update.This is a comma-separated list of fully qualified names of fields. Example: "user.displayName,photo".





Request body
The request body contains an instance of GenerateContentBatch.



Fields






model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}.







displayName


string



Required. The user-defined name of this batch.







inputConfig


object (InputConfig)



Required. Input configuration of the instances on which batch processing are performed.







priority


string (int64 format)



Optional. The priority of the batch. Batches with a higher priority value will be processed before batches with a lower priority value. Negative values are allowed. Default is 0.









Response body
If successful, the response body contains an instance of GenerateContentBatch.




GenerateContentRequest



Request to generate a completion from the model.




Fields






model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}.







contents[]


object (Content)



Required. The content of the current conversation with the model.For single-turn queries, this is a single instance. For multi-turn queries like chat, this is a repeated field that contains the conversation history and the latest request.







tools[]


object (Tool)



Optional. A list of Tools the Model may use to generate the next response.A Tool is a piece of code that enables the system to interact with external systems to perform an action, or set of actions, outside of knowledge and scope of the Model. Supported Tools are Function and codeExecution. Refer to the Function calling and the Code execution guides to learn more.







toolConfig


object (ToolConfig)



Optional. Tool configuration for any Tool specified in the request. Refer to the Function calling guide for a usage example.







safetySettings[]


object (SafetySetting)



Optional. A list of unique SafetySetting instances for blocking unsafe content.This will be enforced on the GenerateContentRequest.contents and GenerateContentResponse.candidates. There should not be more than one setting for each SafetyCategory type. The API will block any contents and responses that fail to meet the thresholds set by these settings. This list overrides the default settings for each SafetyCategory specified in the safetySettings. If there is no SafetySetting for a given SafetyCategory provided in the list, the API will use the default safety setting for that category. Harm categories HARM_CATEGORY_HATE_SPEECH, HARM_CATEGORY_SEXUALLY_EXPLICIT, HARM_CATEGORY_DANGEROUS_CONTENT, HARM_CATEGORY_HARASSMENT, HARM_CATEGORY_CIVIC_INTEGRITY are supported. Refer to the guide for detailed information on available safety settings. Also refer to the Safety guidance to learn how to incorporate safety considerations in your AI applications.







systemInstruction


object (Content)



Optional. Developer set system instruction(s). Currently, text only.







generationConfig


object (GenerationConfig)



Optional. Configuration options for model generation and outputs.







cachedContent


string



Optional. The name of the content cached to use as context to serve the prediction. Format: cachedContents/{cachedContent}










JSON representation




{
  "model": string,
  "contents": [
    {
      object (Content)
    }
  ],
  "tools": [
    {
      object (Tool)
    }
  ],
  "toolConfig": {
    object (ToolConfig)
  },
  "safetySettings": [
    {
      object (SafetySetting)
    }
  ],
  "systemInstruction": {
    object (Content)
  },
  "generationConfig": {
    object (GenerationConfig)
  },
  "cachedContent": string
}








BatchState




The state of the batch.









Enums




BATCH_STATE_UNSPECIFIED
The batch state is unspecified.


BATCH_STATE_PENDING
The service is preparing to run the batch.


BATCH_STATE_RUNNING
The batch is in progress.


BATCH_STATE_SUCCEEDED
The batch completed successfully.


BATCH_STATE_FAILED
The batch failed.


BATCH_STATE_CANCELLED
The batch has been cancelled.


BATCH_STATE_EXPIRED
The batch has expired.





REST Resource: batches




Resource: Operation

JSON representation

Methods


Resource: Operation



This resource represents a long-running operation that is the result of a network API call.




Fields






name


string



The server-assigned name, which is only unique within the same service that originally returns it. If you use the default HTTP mapping, the name should be a resource name ending with operations/{unique_id}.







metadata


object



Service-specific metadata associated with the operation. It typically contains progress information and common metadata such as create time. Some services might not provide such metadata. Any method that returns a long-running operation should document the metadata type, if any.An object containing fields of an arbitrary type. An additional field "@type" contains a URI identifying the type. Example: { "id": 1234, "@type": "types.example.com/standard/id" }.







done


boolean



If the value is false, it means the operation is still in progress. If true, the operation is completed, and either error or response is available.







result


Union type



The operation result, which can be either an error or a valid response. If done == false, neither error nor response is set. If done == true, exactly one of error or response can be set. Some services might not provide the result. result can be only one of the following:




error


object (Status)



The error result of the operation in case of failure or cancellation.







response


object



The normal, successful response of the operation. If the original method returns no data on success, such as Delete, the response is google.protobuf.Empty. If the original method is standard Get/Create/Update, the response should be the resource. For other methods, the response should have the type XxxResponse, where Xxx is the original method name. For example, if the original method name is TakeSnapshot(), the inferred response type is TakeSnapshotResponse.An object containing fields of an arbitrary type. An additional field "@type" contains a URI identifying the type. Example: { "id": 1234, "@type": "types.example.com/standard/id" }.













JSON representation




{
  "name": string,
  "metadata": {
    "@type": string,
    field1: ...,
    ...
  },
  "done": boolean,

  // result
  "error": {
    object (Status)
  },
  "response": {
    "@type": string,
    field1: ...,
    ...
  }
  // Union type
}









  

  
