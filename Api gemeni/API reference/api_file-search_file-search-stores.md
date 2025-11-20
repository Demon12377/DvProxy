# File Search Stores

Source: https://ai.google.dev/api/file-search/file-search-stores

==================



  
    
    The File Search API provides a hosted question answering service for building Retrieval Augmented Generation (RAG) systems using Google's infrastructure.

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
    Method: media.uploadToFileSearchStore




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation






Uploads data to a FileSearchStore, preprocesses and chunks before storing it in a FileSearchStore Document.




Endpoint


Upload URI, for media upload requests:




                post
              

https://generativelanguage.googleapis.com/upload/v1beta/{fileSearchStoreName=fileSearchStores/*}:uploadToFileSearchStore




Metadata URI, for metadata-only requests:




                post
              

https://generativelanguage.googleapis.com/v1beta/{fileSearchStoreName=fileSearchStores/*}:uploadToFileSearchStore







Path parameters




fileSearchStoreName


string



Required. Immutable. The name of the FileSearchStore to upload the file into. Example: fileSearchStores/my-file-search-store-123 It takes the form fileSearchStores/{filesearchstore}.





Request body
The request body contains data with the following structure:



Fields






displayName


string



Optional. Display name of the created document.







customMetadata[]


object (CustomMetadata)



Custom metadata to be associated with the data.







chunkingConfig


object (ChunkingConfig)



Optional. Config for telling the service how to chunk the data. If not provided, the service will use default parameters.







mimeType


string



Optional. MIME type of the data. If not provided, it will be inferred from the uploaded content.










Response body

If successful, the response body contains data with the following structure:




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







Method: fileSearchStores.create




EndpointRequest bodyResponse bodyAuthorization scopes




Creates an empty FileSearchStore.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/fileSearchStores








Request body
The request body contains an instance of FileSearchStore.



Fields






displayName


string



Optional. The human-readable display name for the FileSearchStore. The display name must be no more than 512 characters in length, including spaces. Example: "Docs on Semantic Retriever"









Response body
If successful, the response body contains a newly created instance of FileSearchStore.




Method: fileSearchStores.delete




EndpointPath parametersQuery parametersRequest bodyResponse bodyAuthorization scopes




Deletes a FileSearchStore.




Endpoint


                delete
              

https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*}








Path parameters




name


string



Required. The resource name of the FileSearchStore. Example: fileSearchStores/my-file-search-store-123 It takes the form fileSearchStores/{filesearchstore}.





Query parameters




force


boolean



Optional. If set to true, any Documents and objects related to this FileSearchStore will also be deleted.If false (the default), a FAILED_PRECONDITION error will be returned if FileSearchStore contains any Documents.





Request body
The request body must be empty.






Response body
If successful, the response body is an empty JSON object.




Method: fileSearchStores.get




EndpointPath parametersRequest bodyResponse bodyAuthorization scopes




Gets information about a specific FileSearchStore.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*}








Path parameters




name


string



Required. The name of the FileSearchStore. Example: fileSearchStores/my-file-search-store-123 It takes the form fileSearchStores/{filesearchstore}.





Request body
The request body must be empty.






Response body
If successful, the response body contains an instance of FileSearchStore.




Method: fileSearchStores.list




EndpointQuery parametersRequest bodyResponse body

JSON representation

Authorization scopes




Lists all FileSearchStores owned by the user.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/fileSearchStores








Query parameters




pageSize


integer



Optional. The maximum number of FileSearchStores to return (per page). The service may return fewer FileSearchStores.If unspecified, at most 10 FileSearchStores will be returned. The maximum size limit is 20 FileSearchStores per page.







pageToken


string



Optional. A page token, received from a previous fileSearchStores.list call.Provide the nextPageToken returned in the response as an argument to the next request to retrieve the next page.When paginating, all other parameters provided to fileSearchStores.list must match the call that provided the page token.





Request body
The request body must be empty.






Response body

Response from fileSearchStores.list containing a paginated list of FileSearchStores. The results are sorted by ascending fileSearchStore.create_time.
If successful, the response body contains data with the following structure:




Fields






fileSearchStores[]


object (FileSearchStore)



The returned ragStores.







nextPageToken


string



A token, which can be sent as pageToken to retrieve the next page. If this field is omitted, there are no more pages.











JSON representation




{
  "fileSearchStores": [
    {
      object (FileSearchStore)
    }
  ],
  "nextPageToken": string
}







Method: fileSearchStores.importFile




EndpointPath parametersRequest body

JSON representation

Response body




Imports a File from File Service to a FileSearchStore.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{fileSearchStoreName=fileSearchStores/*}:importFile








Path parameters




fileSearchStoreName


string



Required. Immutable. The name of the FileSearchStore to import the file into. Example: fileSearchStores/my-file-search-store-123 It takes the form fileSearchStores/{filesearchstore}.





Request body
The request body contains data with the following structure:



Fields






fileName


string



Required. The name of the File to import. Example: files/abc-123







customMetadata[]


object (CustomMetadata)



Custom metadata to be associated with the file.







chunkingConfig


object (ChunkingConfig)



Optional. Config for telling the service how to chunk the file. If not provided, the service will use default parameters.










Response body
If successful, the response body contains an instance of Operation.




REST Resource: fileSearchStores.operations




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








Method: fileSearchStores.operations.get




EndpointPath parametersRequest bodyResponse bodyAuthorization scopes


Gets the latest state of a long-running operation. Clients can use this method to poll the operation result at intervals as recommended by the API service.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/operations/*}








Path parameters




name


string



The name of the operation resource. It takes the form fileSearchStores/{filesearchstore}/operations/{operation}.





Request body
The request body must be empty.






Response body
If successful, the response body contains an instance of Operation.




REST Resource: fileSearchStores.upload.operations




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








Method: fileSearchStores.upload.operations.get




EndpointPath parametersRequest bodyResponse bodyAuthorization scopes


Gets the latest state of a long-running operation. Clients can use this method to poll the operation result at intervals as recommended by the API service.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/upload/operations/*}








Path parameters




name


string



The name of the operation resource. It takes the form fileSearchStores/{filesearchstore}/upload/operations/{operation}.





Request body
The request body must be empty.






Response body
If successful, the response body contains an instance of Operation.




REST Resource: fileSearchStores




Resource: FileSearchStore

JSON representation

Methods


Resource: FileSearchStore



A FileSearchStore is a collection of Documents.




Fields






name


string



Output only. Immutable. Identifier. The FileSearchStore resource name. It is an ID (name excluding the "fileSearchStores/" prefix) that can contain up to 40 characters that are lowercase alphanumeric or dashes (-). It is output only. The unique name will be derived from displayName along with a 12 character random suffix. Example: fileSearchStores/my-awesome-file-search-store-123a456b789c If displayName is not provided, the name will be randomly generated.







displayName


string



Optional. The human-readable display name for the FileSearchStore. The display name must be no more than 512 characters in length, including spaces. Example: "Docs on Semantic Retriever"







createTime


string (Timestamp format)



Output only. The Timestamp of when the FileSearchStore was created.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







updateTime


string (Timestamp format)



Output only. The Timestamp of when the FileSearchStore was last updated.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







activeDocumentsCount


string (int64 format)



Output only. The number of documents in the FileSearchStore that are active and ready for retrieval.







pendingDocumentsCount


string (int64 format)



Output only. The number of documents in the FileSearchStore that are being processed.







failedDocumentsCount


string (int64 format)



Output only. The number of documents in the FileSearchStore that have failed processing.







sizeBytes


string (int64 format)



Output only. The size of raw bytes ingested into the FileSearchStore. This is the total size of all the documents in the FileSearchStore.










JSON representation




{
  "name": string,
  "displayName": string,
  "createTime": string,
  "updateTime": string,
  "activeDocumentsCount": string,
  "pendingDocumentsCount": string,
  "failedDocumentsCount": string,
  "sizeBytes": string
}









  

  
