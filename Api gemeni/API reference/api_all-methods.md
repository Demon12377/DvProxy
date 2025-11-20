# All methods

Source: https://ai.google.dev/api/all-methods

==================



  
    
    
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
    Generative Language API



The Gemini API allows developers to build generative AI applications using Gemini models. Gemini is our most capable model, built from the ground up to be multimodal. It can generalize and seamlessly understand, operate across, and combine different types of information including language, images, audio, video, and code. You can use the Gemini API for use cases like reasoning across text and images, content generation, dialogue agents, summarization and classification systems, and more.

REST Resource: v1beta.batchesREST Resource: v1beta.cachedContentsREST Resource: v1beta.corporaREST Resource: v1beta.corpora.documentsREST Resource: v1beta.corpora.documents.chunksREST Resource: v1beta.corpora.operationsREST Resource: v1beta.corpora.permissionsREST Resource: v1beta.dynamicREST Resource: v1beta.fileSearchStoresREST Resource: v1beta.fileSearchStores.documentsREST Resource: v1beta.fileSearchStores.operationsREST Resource: v1beta.fileSearchStores.upload.operationsREST Resource: v1beta.filesREST Resource: v1beta.generatedFilesREST Resource: v1beta.generatedFiles.operationsREST Resource: v1beta.mediaREST Resource: v1beta.modelsREST Resource: v1beta.models.operationsREST Resource: v1beta.tunedModelsREST Resource: v1beta.tunedModels.operationsREST Resource: v1beta.tunedModels.permissions


Service: generativelanguage.googleapis.com
To call this service, we recommend that you use the Google-provided client libraries. If your application needs to use your own libraries to call this service, use the following information when you make the API requests.

Service endpoint
A service endpoint is a base URL that specifies the network address of an API service. One service might have multiple service endpoints. This service has the following service endpoint and all URIs below are relative to this service endpoint:

https://generativelanguage.googleapis.com




REST Resource: v1beta.batches








Methods





cancel

POST /v1beta/{name=batches/*}:cancel 
                  Starts asynchronous cancellation on a long-running operation.



delete

DELETE /v1beta/{name=batches/*} 
                  Deletes a long-running operation.



get

GET /v1beta/{name=batches/*} 
                  Gets the latest state of a long-running operation.



list

GET /v1beta/{name=batches} 
                  Lists operations that match the specified filter in the request.



updateEmbedContentBatch

PATCH /v1beta/{embedContentBatch.name=batches/*}:updateEmbedContentBatch 
                  Updates a batch of EmbedContent requests for batch processing.



updateGenerateContentBatch

PATCH /v1beta/{generateContentBatch.name=batches/*}:updateGenerateContentBatch 
                  Updates a batch of GenerateContent requests for batch processing.






REST Resource: v1beta.cachedContents








Methods





create

POST /v1beta/cachedContents 
                  Creates CachedContent resource.



delete

DELETE /v1beta/{name=cachedContents/*} 
                  Deletes CachedContent resource.



get

GET /v1beta/{name=cachedContents/*} 
                  Reads CachedContent resource.



list

GET /v1beta/cachedContents 
                  Lists CachedContents.



patch

PATCH /v1beta/{cachedContent.name=cachedContents/*} 
                  Updates CachedContent resource (only expiration is updatable).












REST Resource: v1beta.fileSearchStores








Methods





create

POST /v1beta/fileSearchStores 
                  Creates an empty FileSearchStore.



delete

DELETE /v1beta/{name=fileSearchStores/*} 
                  Deletes a FileSearchStore.



get

GET /v1beta/{name=fileSearchStores/*} 
                  Gets information about a specific FileSearchStore.



importFile

POST /v1beta/{fileSearchStoreName=fileSearchStores/*}:importFile 
                  Imports a File from File Service to a FileSearchStore.



list

GET /v1beta/fileSearchStores 
                  Lists all FileSearchStores owned by the user.






REST Resource: v1beta.fileSearchStores.documents








Methods





delete

DELETE /v1beta/{name=fileSearchStores/*/documents/*} 
                  Deletes a Document.



get

GET /v1beta/{name=fileSearchStores/*/documents/*} 
                  Gets information about a specific Document.



list

GET /v1beta/{parent=fileSearchStores/*}/documents 
                  Lists all Documents in a Corpus.



query

POST /v1beta/{name=fileSearchStores/*/documents/*}:query 
                  Performs semantic search over a Document.






REST Resource: v1beta.fileSearchStores.operations








Methods





get

GET /v1beta/{name=fileSearchStores/*/operations/*} 
                  Gets the latest state of a long-running operation.






REST Resource: v1beta.fileSearchStores.upload.operations








Methods





get

GET /v1beta/{name=fileSearchStores/*/upload/operations/*} 
                  Gets the latest state of a long-running operation.






REST Resource: v1beta.files








Methods





delete

DELETE /v1beta/{name=files/*} 
                  Deletes the File.



get

GET /v1beta/{name=files/*} 
                  Gets the metadata for the given File.



list

GET /v1beta/files 
                  Lists the metadata for Files owned by the requesting project.








REST Resource: v1beta.media








Methods






upload

POST /v1beta/files 
POST /upload/v1beta/files 
                  Creates a File.



uploadToFileSearchStore

POST /v1beta/{fileSearchStoreName=fileSearchStores/*}:uploadToFileSearchStore 
POST /upload/v1beta/{fileSearchStoreName=fileSearchStores/*}:uploadToFileSearchStore 
                  Uploads data to a FileSearchStore, preprocesses and chunks before storing it in a FileSearchStore Document.






REST Resource: v1beta.models








Methods





asyncBatchEmbedContent

POST /v1beta/{batch.model=models/*}:asyncBatchEmbedContent 
                  Enqueues a batch of EmbedContent requests for batch processing.



batchEmbedContents

POST /v1beta/{model=models/*}:batchEmbedContents 
                  Generates multiple embedding vectors from the input Content which consists of a batch of strings represented as EmbedContentRequest objects.



batchEmbedText

POST /v1beta/{model=models/*}:batchEmbedText 
                  Generates multiple embeddings from the model given input text in a synchronous call.



batchGenerateContent

POST /v1beta/{batch.model=models/*}:batchGenerateContent 
                  Enqueues a batch of GenerateContent requests for batch processing.



countMessageTokens

POST /v1beta/{model=models/*}:countMessageTokens 
                  Runs a model's tokenizer on a string and returns the token count.



countTextTokens

POST /v1beta/{model=models/*}:countTextTokens 
                  Runs a model's tokenizer on a text and returns the token count.



countTokens

POST /v1beta/{model=models/*}:countTokens 
                  Runs a model's tokenizer on input Content and returns the token count.



embedContent

POST /v1beta/{model=models/*}:embedContent 
                  Generates a text embedding vector from the input Content using the specified Gemini Embedding model.



embedText

POST /v1beta/{model=models/*}:embedText 
                  Generates an embedding from the model given an input message.




generateContent

POST /v1beta/{model=models/*}:generateContent 
                  Generates a model response given an input GenerateContentRequest.



generateMessage

POST /v1beta/{model=models/*}:generateMessage 
                  Generates a response from the model given an input MessagePrompt.



generateText

POST /v1beta/{model=models/*}:generateText 
                  Generates a response from the model given an input message.



get

GET /v1beta/{name=models/*} 
                  Gets information about a specific Model such as its version number, token limits, parameters and other metadata.



list

GET /v1beta/models 
                  Lists the Models available through the Gemini API.



predict

POST /v1beta/{model=models/*}:predict 
                  Performs a prediction request.



predictLongRunning

POST /v1beta/{model=models/*}:predictLongRunning 
                  Same as Predict but returns an LRO.



streamGenerateContent

POST /v1beta/{model=models/*}:streamGenerateContent 
                  Generates a streamed response from the model given an input GenerateContentRequest.











  

  
