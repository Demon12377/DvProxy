# Models

Source: https://ai.google.dev/api/models

==================



  
    
    The models endpoint provides a way for you to programmatically list the available models, and retrieve extended metadata such as supported functionality and context window sizing. Read more in the Models guide.

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
    Method: models.get




EndpointPath parametersRequest bodyResponse bodyAuthorization scopesExample request

Get






Gets information about a specific Model such as its version number, token limits, parameters and other metadata. Refer to the Gemini models guide for detailed model information.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=models/*}








Path parameters




name


string



Required. The resource name of the model.This name should match a model name returned by the models.list method.Format: models/{model} It takes the form models/{model}.





Request body
The request body must be empty.



Example request


Python
              






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
model_info = client.models.get(model="gemini-2.0-flash")
print(model_info)models.py




























            

Go
              






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

modelInfo, err := client.Models.Get(ctx, "gemini-2.0-flash", nil)
if err != nil {
	log.Fatal(err)
}

fmt.Println(modelInfo)models.go




























            

Shell
              






  
  














  





  
    
  
  











  









  




  




  curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=$GEMINI_API_KEYmodels.sh




























            






Response body
If successful, the response body contains an instance of Model.




Method: models.list




EndpointQuery parametersRequest bodyResponse body

JSON representation

Authorization scopesExample request

List






Lists the Models available through the Gemini API.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/models








Query parameters




pageSize


integer



The maximum number of Models to return (per page).If unspecified, 50 models will be returned per page. This method returns at most 1000 models per page, even if you pass a larger pageSize.







pageToken


string



A page token, received from a previous models.list call.Provide the pageToken returned by one request as an argument to the next request to retrieve the next page.When paginating, all other parameters provided to models.list must match the call that provided the page token.





Request body
The request body must be empty.



Example request


Python
              






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()

print("List of models that support generateContent:\n")
for m in client.models.list():
    for action in m.supported_actions:
        if action == "generateContent":
            print(m.name)

print("List of models that support embedContent:\n")
for m in client.models.list():
    for action in m.supported_actions:
        if action == "embedContent":
            print(m.name)models.py




























            

Go
              






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}


// Retrieve the list of models.
models, err := client.Models.List(ctx, &genai.ListModelsConfig{})
if err != nil {
	log.Fatal(err)
}

fmt.Println("List of models that support generateContent:")
for _, m := range models.Items {
	for _, action := range m.SupportedActions {
		if action == "generateContent" {
			fmt.Println(m.Name)
			break
		}
	}
}

fmt.Println("\nList of models that support embedContent:")
for _, m := range models.Items {
	for _, action := range m.SupportedActions {
		if action == "embedContent" {
			fmt.Println(m.Name)
			break
		}
	}
}models.go




























            

Shell
              






  
  














  





  
    
  
  











  









  




  




  curl https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEYmodels.sh




























            






Response body

Response from ListModel containing a paginated list of Models.
If successful, the response body contains data with the following structure:




Fields






models[]


object (Model)



The returned Models.







nextPageToken


string



A token, which can be sent as pageToken to retrieve the next page.If this field is omitted, there are no more pages.











JSON representation




{
  "models": [
    {
      object (Model)
    }
  ],
  "nextPageToken": string
}







REST Resource: models




Resource: Model

JSON representation

Methods


Resource: Model



Information about a Generative Language Model.




Fields






name


string



Required. The resource name of the Model. Refer to Model variants for all allowed values.Format: models/{model} with a {model} naming convention of:

"{baseModelId}-{version}"
Examples:

models/gemini-1.5-flash-001








baseModelId


string



Required. The name of the base model, pass this to the generation request.Examples:

gemini-1.5-flash








version


string



Required. The version number of the model.This represents the major version (1.0 or 1.5)







displayName


string



The human-readable name of the model. E.g. "Gemini 1.5 Flash".The name can be up to 128 characters long and can consist of any UTF-8 characters.







description


string



A short description of the model.







inputTokenLimit


integer



Maximum number of input tokens allowed for this model.







outputTokenLimit


integer



Maximum number of output tokens available for this model.







supportedGenerationMethods[]


string



The model's supported generation methods.The corresponding API method names are defined as Pascal case strings, such as generateMessage and generateContent.







thinking


boolean



Whether the model supports thinking.







temperature


number



Controls the randomness of the output.Values can range over [0.0,maxTemperature], inclusive. A higher value will produce responses that are more varied, while a value closer to 0.0 will typically result in less surprising responses from the model. This value specifies default to be used by the backend while making the call to the model.







maxTemperature


number



The maximum temperature this model can use.







topP


number



For Nucleus sampling.Nucleus sampling considers the smallest set of tokens whose probability sum is at least topP. This value specifies default to be used by the backend while making the call to the model.







topK


integer



For Top-k sampling.Top-k sampling considers the set of topK most probable tokens. This value specifies default to be used by the backend while making the call to the model. If empty, indicates the model doesn't use top-k sampling, and topK isn't allowed as a generation parameter.










JSON representation




{
  "name": string,
  "baseModelId": string,
  "version": string,
  "displayName": string,
  "description": string,
  "inputTokenLimit": integer,
  "outputTokenLimit": integer,
  "supportedGenerationMethods": [
    string
  ],
  "thinking": boolean,
  "temperature": number,
  "maxTemperature": number,
  "topP": number,
  "topK": integer
}








Method: models.predict




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation

Authorization scopes




Performs a prediction request.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:predict








Path parameters




model


string



Required. The name of the model for prediction. Format: name=models/{model}. It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






instances[]


value (Value format)



Required. The instances that are the input to the prediction call.







parameters


value (Value format)



Optional. The parameters that govern the prediction call.










Response body

Response message for [PredictionService.Predict].
If successful, the response body contains data with the following structure:




Fields






predictions[]


value (Value format)



The outputs of the prediction call.











JSON representation




{
  "predictions": [
    value
  ]
}







Method: models.predictLongRunning




EndpointPath parametersRequest body

JSON representation

Response bodyAuthorization scopes




Same as models.predict but returns an LRO.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:predictLongRunning








Path parameters




model


string



Required. The name of the model for prediction. Format: name=models/{model}.





Request body
The request body contains data with the following structure:



Fields






instances[]


value (Value format)



Required. The instances that are the input to the prediction call.







parameters


value (Value format)



Optional. The parameters that govern the prediction call.










Response body
If successful, the response body contains an instance of Operation.





  

  
