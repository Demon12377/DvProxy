# PaLM (decommissioned)

Source: https://ai.google.dev/api/palm

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
    Method: models.generateText




EndpointPath parametersRequest body

JSON representation

Response bodyAuthorization scopes




Generates a response from the model given an input message.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateText








Path parameters




model


string



Required. The name of the Model or TunedModel to use for generating the completion. Examples:  models/text-bison-001  tunedModels/sentence-translator-u3b7m It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






prompt


object (TextPrompt)



Required. The free-form input text given to the model as a prompt.Given a prompt, the model will generate a TextCompletion response it predicts as the completion of the input text.







safetySettings[]


object (SafetySetting)



Optional. A list of unique SafetySetting instances for blocking unsafe content.that will be enforced on the GenerateTextRequest.prompt and GenerateTextResponse.candidates. There should not be more than one setting for each SafetyCategory type. The API will block any prompts and responses that fail to meet the thresholds set by these settings. This list overrides the default settings for each SafetyCategory specified in the safetySettings. If there is no SafetySetting for a given SafetyCategory provided in the list, the API will use the default safety setting for that category. Harm categories HARM_CATEGORY_DEROGATORY, HARM_CATEGORY_TOXICITY, HARM_CATEGORY_VIOLENCE, HARM_CATEGORY_SEXUAL, HARM_CATEGORY_MEDICAL, HARM_CATEGORY_DANGEROUS are supported in text service.







stopSequences[]


string



The set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.







temperature


number



Optional. Controls the randomness of the output. Note: The default value varies by model, see the Model.temperature attribute of the Model returned the getModel function.Values can range from [0.0,1.0], inclusive. A value closer to 1.0 will produce responses that are more varied and creative, while a value closer to 0.0 will typically result in more straightforward responses from the model.







candidateCount


integer



Optional. Number of generated responses to return.This value must be between [1, 8], inclusive. If unset, this will default to 1.







maxOutputTokens


integer



Optional. The maximum number of tokens to include in a candidate.If unset, this will default to outputTokenLimit specified in the Model specification.







topP


number



Optional. The maximum cumulative probability of tokens to consider when sampling.The model uses combined Top-k and nucleus sampling.Tokens are sorted based on their assigned probabilities so that only the most likely tokens are considered. Top-k sampling directly limits the maximum number of tokens to consider, while Nucleus sampling limits number of tokens based on the cumulative probability.Note: The default value varies by model, see the Model.top_p attribute of the Model returned the getModel function.







topK


integer



Optional. The maximum number of tokens to consider when sampling.The model uses combined Top-k and nucleus sampling.Top-k sampling considers the set of topK most probable tokens. Defaults to 40.Note: The default value varies by model, see the Model.top_k attribute of the Model returned the getModel function.










Response body
If successful, the response body contains an instance of GenerateTextResponse.




Method: models.countTextTokens




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation

Authorization scopes




Runs a model's tokenizer on a text and returns the token count.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:countTextTokens








Path parameters




model


string



Required. The model's resource name. This serves as an ID for the Model to use.This name should match a model name returned by the models.list method.Format: models/{model} It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






prompt


object (TextPrompt)



Required. The free-form input text given to the model as a prompt.










Response body

A response from models.countTextTokens.It returns the model's tokenCount for the prompt.
If successful, the response body contains data with the following structure:




Fields






tokenCount


integer



The number of tokens that the model tokenizes the prompt into.Always non-negative.











JSON representation




{
  "tokenCount": integer
}







Method: models.generateMessage




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation

Authorization scopes




Generates a response from the model given an input MessagePrompt.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateMessage








Path parameters




model


string



Required. The name of the model to use.Format: name=models/{model}. It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






prompt


object (MessagePrompt)



Required. The structured textual input given to the model as a prompt.Given a prompt, the model will return what it predicts is the next message in the discussion.







temperature


number



Optional. Controls the randomness of the output.Values can range over [0.0,1.0], inclusive. A value closer to 1.0 will produce responses that are more varied, while a value closer to 0.0 will typically result in less surprising responses from the model.







candidateCount


integer



Optional. The number of generated response messages to return.This value must be between [1, 8], inclusive. If unset, this will default to 1.







topP


number



Optional. The maximum cumulative probability of tokens to consider when sampling.The model uses combined Top-k and nucleus sampling.Nucleus sampling considers the smallest set of tokens whose probability sum is at least topP.







topK


integer



Optional. The maximum number of tokens to consider when sampling.The model uses combined Top-k and nucleus sampling.Top-k sampling considers the set of topK most probable tokens.










Response body

The response from the model.This includes candidate messages and conversation history in the form of chronologically-ordered messages.
If successful, the response body contains data with the following structure:




Fields






candidates[]


object (Message)



Candidate response messages from the model.







messages[]


object (Message)



The conversation history used by the model.







filters[]


object (ContentFilter)



A set of content filtering metadata for the prompt and response text.This indicates which SafetyCategory(s) blocked a candidate from this response, the lowest HarmProbability that triggered a block, and the HarmThreshold setting for that category.











JSON representation




{
  "candidates": [
    {
      object (Message)
    }
  ],
  "messages": [
    {
      object (Message)
    }
  ],
  "filters": [
    {
      object (ContentFilter)
    }
  ]
}







Method: models.countMessageTokens




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation

Authorization scopes




Runs a model's tokenizer on a string and returns the token count.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:countMessageTokens








Path parameters




model


string



Required. The model's resource name. This serves as an ID for the Model to use.This name should match a model name returned by the models.list method.Format: models/{model} It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






prompt


object (MessagePrompt)



Required. The prompt, whose token count is to be returned.










Response body

A response from models.countMessageTokens.It returns the model's tokenCount for the prompt.
If successful, the response body contains data with the following structure:




Fields






tokenCount


integer



The number of tokens that the model tokenizes the prompt into.Always non-negative.











JSON representation




{
  "tokenCount": integer
}







Method: models.embedText




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation

Authorization scopes




Generates an embedding from the model given an input message.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:embedText








Path parameters




model


string



Required. The model name to use with the format model=models/{model}. It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






text


string



Optional. The free-form input text that the model will turn into an embedding.










Response body

The response to a EmbedTextRequest.
If successful, the response body contains data with the following structure:




Fields






embedding


object (Embedding)



Output only. The embedding generated from the input text.











JSON representation




{
  "embedding": {
    object (Embedding)
  }
}







Method: models.batchEmbedText




EndpointPath parametersRequest body

JSON representation

Response body

JSON representation

Authorization scopesEmbedTextRequest

JSON representation






Generates multiple embeddings from the model given input text in a synchronous call.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:batchEmbedText








Path parameters




model


string



Required. The name of the Model to use for generating the embedding. Examples:  models/embedding-gecko-001 It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






texts[]


string



Optional. The free-form input texts that the model will turn into an embedding. The current limit is 100 texts, over which an error will be thrown.







requests[]


object (EmbedTextRequest)



Optional. Embed requests for the batch. Only one of texts or requests can be set.










Response body

The response to a EmbedTextRequest.
If successful, the response body contains data with the following structure:




Fields






embeddings[]


object (Embedding)



Output only. The embeddings generated from the input text.











JSON representation




{
  "embeddings": [
    {
      object (Embedding)
    }
  ]
}







EmbedTextRequest



Request to get a text embedding from the model.




Fields






model


string



Required. The model name to use with the format model=models/{model}.







text


string



Optional. The free-form input text that the model will turn into an embedding.










JSON representation




{
  "model": string,
  "text": string
}








ContentFilter




JSON representationBlockedReason




Content filtering metadata associated with processing a single request.ContentFilter contains a reason and an optional supporting string. The reason may be unspecified.




Fields






reason


enum (BlockedReason)



The reason content was blocked during request processing.







message


string



A string that describes the filtering behavior in more detail.










JSON representation




{
  "reason": enum (BlockedReason),
  "message": string
}






BlockedReason

A list of reasons why content may have been blocked.









Enums




BLOCKED_REASON_UNSPECIFIED
A blocked reason was not specified.


SAFETY
Content was blocked by safety settings.


OTHER
Content was blocked, but the reason is uncategorized.





Embedding




JSON representation




A list of floats representing the embedding.




Fields






value[]


number



The embedding values.










JSON representation




{
  "value": [
    number
  ]
}







Message




JSON representation




The base unit of structured text.A Message includes an author and the content of the Message.The author is used to tag messages when they are fed to the model as text.




Fields






author


string



Optional. The author of this Message.This serves as a key for tagging the content of this Message when it is fed to the model as text.The author can be any alphanumeric string.







content


string



Required. The text content of the structured Message.







citationMetadata


object (CitationMetadata)



Output only. Citation information for model-generated content in this Message.If this Message was generated as output from the model, this field may be populated with attribution information for any text included in the content. This field is used only on output.










JSON representation




{
  "author": string,
  "content": string,
  "citationMetadata": {
    object (CitationMetadata)
  }
}







MessagePrompt




JSON representationExample

JSON representation






All of the structured input text passed to the model as a prompt.A MessagePrompt contains a structured set of fields that provide context for the conversation, examples of user input/model output message pairs that prime the model to respond in different ways, and the conversation history or list of messages representing the alternating turns of the conversation between the user and the model.




Fields






context


string



Optional. Text that should be provided to the model first to ground the response.If not empty, this context will be given to the model first before the examples and messages. When using a context be sure to provide it with every request to maintain continuity.This field can be a description of your prompt to the model to help provide context and guide the responses. Examples: "Translate the phrase from English to French." or "Given a statement, classify the sentiment as happy, sad or neutral."Anything included in this field will take precedence over message history if the total input size exceeds the model's inputTokenLimit and the input request is truncated.







examples[]


object (Example)



Optional. Examples of what the model should generate.This includes both user input and the response that the model should emulate.These examples are treated identically to conversation messages except that they take precedence over the history in messages: If the total input size exceeds the model's inputTokenLimit the input will be truncated. Items will be dropped from messages before examples.







messages[]


object (Message)



Required. A snapshot of the recent conversation history sorted chronologically.Turns alternate between two authors.If the total input size exceeds the model's inputTokenLimit the input will be truncated: The oldest items will be dropped from messages.










JSON representation




{
  "context": string,
  "examples": [
    {
      object (Example)
    }
  ],
  "messages": [
    {
      object (Message)
    }
  ]
}






Example



An input/output example used to instruct the Model.It demonstrates how the model should respond or format its response.




Fields






input


object (Message)



Required. An example of an input Message from the user.







output


object (Message)



Required. An example of what the model should output given the input.










JSON representation




{
  "input": {
    object (Message)
  },
  "output": {
    object (Message)
  }
}







GenerateTextResponse




JSON representationTextCompletion

JSON representation

SafetyFeedback

JSON representation






The response from the model, including candidate completions.




Fields






candidates[]


object (TextCompletion)



Candidate responses from the model.







filters[]


object (ContentFilter)



A set of content filtering metadata for the prompt and response text.This indicates which SafetyCategory(s) blocked a candidate from this response, the lowest HarmProbability that triggered a block, and the HarmThreshold setting for that category. This indicates the smallest change to the SafetySettings that would be necessary to unblock at least 1 response.The blocking is configured by the SafetySettings in the request (or the default SafetySettings of the API).







safetyFeedback[]


object (SafetyFeedback)



Returns any safety feedback related to content filtering.










JSON representation




{
  "candidates": [
    {
      object (TextCompletion)
    }
  ],
  "filters": [
    {
      object (ContentFilter)
    }
  ],
  "safetyFeedback": [
    {
      object (SafetyFeedback)
    }
  ]
}






TextCompletion



Output text returned from a model.




Fields






output


string



Output only. The generated text returned from the model.







safetyRatings[]


object (SafetyRating)



Ratings for the safety of a response.There is at most one rating per category.







citationMetadata


object (CitationMetadata)



Output only. Citation information for model-generated output in this TextCompletion.This field may be populated with attribution information for any text included in the output.










JSON representation




{
  "output": string,
  "safetyRatings": [
    {
      object (SafetyRating)
    }
  ],
  "citationMetadata": {
    object (CitationMetadata)
  }
}






SafetyFeedback



Safety feedback for an entire request.This field is populated if content in the input and/or response is blocked due to safety settings. SafetyFeedback may not exist for every HarmCategory. Each SafetyFeedback will return the safety settings used by the request as well as the lowest HarmProbability that should be allowed in order to return a result.




Fields






rating


object (SafetyRating)



Safety rating evaluated from content.







setting


object (SafetySetting)



Safety settings applied to the request.










JSON representation




{
  "rating": {
    object (SafetyRating)
  },
  "setting": {
    object (SafetySetting)
  }
}







TextPrompt




JSON representation




Text given to the model as a prompt.The Model will use this TextPrompt to Generate a text completion.




Fields






text


string



Required. The prompt text.










JSON representation




{
  "text": string
}








  

  
