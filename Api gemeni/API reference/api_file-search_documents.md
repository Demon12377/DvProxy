# Documents

Source: https://ai.google.dev/api/file-search/documents

==================



  
    
    The File Search API references your raw source files, or documents, as temporary File objects.

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
    Method: fileSearchStores.documents.delete




EndpointPath parametersQuery parametersRequest bodyResponse bodyAuthorization scopes




Deletes a Document.




Endpoint


                delete
              

https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/documents/*}








Path parameters




name


string



Required. The resource name of the Document to delete. Example: fileSearchStores/my-file-search-store-123/documents/the-doc-abc It takes the form fileSearchStores/{filesearchstore}/documents/{document}.





Query parameters




force


boolean



Optional. If set to true, any Chunks and objects related to this Document will also be deleted.If false (the default), a FAILED_PRECONDITION error will be returned if Document contains any Chunks.





Request body
The request body must be empty.






Response body
If successful, the response body is an empty JSON object.




Method: fileSearchStores.documents.get




EndpointPath parametersRequest bodyResponse bodyAuthorization scopes




Gets information about a specific Document.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/documents/*}








Path parameters




name


string



Required. The name of the Document to retrieve. Example: fileSearchStores/my-file-search-store-123/documents/the-doc-abc It takes the form fileSearchStores/{filesearchstore}/documents/{document}.





Request body
The request body must be empty.






Response body
If successful, the response body contains an instance of Document.




Method: fileSearchStores.documents.list




EndpointPath parametersQuery parametersRequest bodyResponse body

JSON representation

Authorization scopes




Lists all Documents in a Corpus.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{parent=fileSearchStores/*}/documents








Path parameters




parent


string



Required. The name of the FileSearchStore containing Documents. Example: fileSearchStores/my-file-search-store-123 It takes the form fileSearchStores/{filesearchstore}.





Query parameters




pageSize


integer



Optional. The maximum number of Documents to return (per page). The service may return fewer Documents.If unspecified, at most 10 Documents will be returned. The maximum size limit is 20 Documents per page.







pageToken


string



Optional. A page token, received from a previous documents.list call.Provide the nextPageToken returned in the response as an argument to the next request to retrieve the next page.When paginating, all other parameters provided to documents.list must match the call that provided the page token.





Request body
The request body must be empty.






Response body

Response from documents.list containing a paginated list of Documents. The Documents are sorted by ascending document.create_time.
If successful, the response body contains data with the following structure:




Fields






documents[]


object (Document)



The returned Documents.







nextPageToken


string



A token, which can be sent as pageToken to retrieve the next page. If this field is omitted, there are no more pages.











JSON representation




{
  "documents": [
    {
      object (Document)
    }
  ],
  "nextPageToken": string
}







Method: fileSearchStores.documents.query




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation

Authorization scopes




Performs semantic search over a Document.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/documents/*}:query








Path parameters




name


string



Required. The name of the Document to query. Example: fileSearchStores/my-file-search-store-123/documents/the-doc-abc It takes the form fileSearchStores/{filesearchstore}/documents/{document}.





Request body
The request body contains data with the following structure:



Fields






query


string



Required. Query string to perform semantic search.







resultsCount


integer



Optional. The maximum number of Chunks to return. The service may return fewer Chunks.If unspecified, at most 10 Chunks will be returned. The maximum specified result count is 100.







metadataFilters[]


object (MetadataFilter)



Optional. Filter for Chunk metadata. Each MetadataFilter object should correspond to a unique key. Multiple MetadataFilter objects are joined by logical "AND"s.Note: Document-level filtering is not supported for this request because a Document name is already specified.Example query: (year >= 2020 OR year < 2010) AND (genre = drama OR genre = action)MetadataFilter object list:  metadataFilters = [  {key = "chunk.custom_metadata.year"  conditions = [{int_value = 2020, operation = GREATER_EQUAL},  {int_value = 2010, operation = LESS}},  {key = "chunk.custom_metadata.genre"  conditions = [{stringValue = "drama", operation = EQUAL},  {stringValue = "action", operation = EQUAL}}]Example query for a numeric range of values: (year > 2015 AND year <= 2020)MetadataFilter object list:  metadataFilters = [  {key = "chunk.custom_metadata.year"  conditions = [{int_value = 2015, operation = GREATER}]},  {key = "chunk.custom_metadata.year"  conditions = [{int_value = 2020, operation = LESS_EQUAL}]}]Note: "AND"s for the same key are only supported for numeric values. String values only support "OR"s for the same key.










Response body

Response from documents.query containing a list of relevant chunks.
If successful, the response body contains data with the following structure:




Fields






relevantChunks[]


object (RelevantChunk)



The returned relevant chunks.











JSON representation




{
  "relevantChunks": [
    {
      object (RelevantChunk)
    }
  ]
}







REST Resource: fileSearchStores.documents




Resource: Document

JSON representation

StateMethods


Resource: Document



A Document is a collection of Chunks.




Fields






name


string



Immutable. Identifier. The Document resource name. The ID (name excluding the "fileSearchStores/*/documents/" prefix) can contain up to 40 characters that are lowercase alphanumeric or dashes (-). The ID cannot start or end with a dash. If the name is empty on create, a unique name will be derived from displayName along with a 12 character random suffix. Example: fileSearchStores/{file_search_store_id}/documents/my-awesome-doc-123a456b789c







displayName


string



Optional. The human-readable display name for the Document. The display name must be no more than 512 characters in length, including spaces. Example: "Semantic Retriever Documentation"







customMetadata[]


object (CustomMetadata)



Optional. User provided custom metadata stored as key-value pairs used for querying. A Document can have a maximum of 20 CustomMetadata.







updateTime


string (Timestamp format)



Output only. The Timestamp of when the Document was last updated.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







createTime


string (Timestamp format)



Output only. The Timestamp of when the Document was created.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







state


enum (State)



Output only. Current state of the Document.







sizeBytes


string (int64 format)



Output only. The size of raw bytes ingested into the Document.







mimeType


string



Output only. The mime type of the Document.










JSON representation




{
  "name": string,
  "displayName": string,
  "customMetadata": [
    {
      object (CustomMetadata)
    }
  ],
  "updateTime": string,
  "createTime": string,
  "state": enum (State),
  "sizeBytes": string,
  "mimeType": string
}








State

States for the lifecycle of a Document.









Enums




STATE_UNSPECIFIED
The default value. This value is used if the state is omitted.


STATE_PENDING
Some Chunks of the Document are being processed (embedding and vector storage).


STATE_ACTIVE
All Chunks of the Document is processed and available for querying.


STATE_FAILED
Some Chunks of the Document failed processing.







  

  
