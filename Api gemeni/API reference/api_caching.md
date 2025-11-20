# Caching

Source: https://ai.google.dev/api/caching

==================



  
    
    Context caching allows you to save and reuse precomputed input tokens that you wish to use repeatedly, for example when asking different questions about the same media file. This can lead to cost and speed savings, depending on the usage. For a detailed introduction, see the Context caching guide.

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
    Method: cachedContents.create




EndpointRequest bodyResponse bodyExample request

BasicFrom nameFrom chat






Creates CachedContent resource.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/cachedContents








Request body
The request body contains an instance of CachedContent.



Fields






contents[]


object (Content)



Optional. Input only. Immutable. The content to cache.







tools[]


object (Tool)



Optional. Input only. Immutable. A list of Tools the model may use to generate the next response







expiration


Union type



Specifies when this resource will expire. expiration can be only one of the following:




expireTime


string (Timestamp format)



Timestamp in UTC of when this resource is considered expired. This is always provided on output, regardless of what was sent on input.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







ttl


string (Duration format)



Input only. New TTL for this resource, input only.A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".










displayName


string



Optional. Immutable. The user-generated meaningful display name of the cached content. Maximum 128 Unicode characters.







model


string



Required. Immutable. The name of the Model to use for cached content Format: models/{model}







systemInstruction


object (Content)



Optional. Input only. Immutable. Developer set system instruction. Currently text only.







toolConfig


object (ToolConfig)



Optional. Input only. Immutable. Tool config. This config is shared for all tools.






Example request


Basic


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
document = client.files.upload(file=media / "a11.txt")
model_name = "gemini-1.5-flash-001"

cache = client.caches.create(
    model=model_name,
    config=types.CreateCachedContentConfig(
        contents=[document],
        system_instruction="You are an expert analyzing transcripts.",
    ),
)
print(cache)

response = client.models.generate_content(
    model=model_name,
    contents="Please summarize this transcript",
    config=types.GenerateContentConfig(cached_content=cache.name),
)
print(response.text)cache.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);
const modelName = "gemini-1.5-flash-001";

const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});
console.log("Cache created:", cache);

const response = await ai.models.generateContent({
  model: modelName,
  contents: "Please summarize this transcript",
  config: { cachedContent: cache.name },
});
console.log("Response text:", response.text);cache.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"), 
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

modelName := "gemini-1.5-flash-001"
document, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "a11.txt"), 
	&genai.UploadFileConfig{
		MIMEType : "text/plain",
	},
)
if err != nil {
	log.Fatal(err)
}
parts := []*genai.Part{
	genai.NewPartFromURI(document.URI, document.MIMEType),
}
contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}
cache, err := client.Caches.Create(ctx, modelName, &genai.CreateCachedContentConfig{
	Contents: contents,
	SystemInstruction: genai.NewContentFromText(
		"You are an expert analyzing transcripts.", genai.RoleUser,
	),
})
if err != nil {
	log.Fatal(err)
}
fmt.Println("Cache created:")
fmt.Println(cache)

// Use the cache for generating content.
response, err := client.Models.GenerateContent(
	ctx,
	modelName,
	genai.Text("Please summarize this transcript"),
	&genai.GenerateContentConfig{
		CachedContent: cache.Name,
	},
)
if err != nil {
	log.Fatal(err)
}
printResponse(response)cache.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  wget https://storage.googleapis.com/generativeai-downloads/data/a11.txt
echo '{
  "model": "models/gemini-1.5-flash-001",
  "contents":[
    {
      "parts":[
        {
          "inline_data": {
            "mime_type":"text/plain",
            "data": "'$(base64 $B64FLAGS a11.txt)'"
          }
        }
      ],
    "role": "user"
    }
  ],
  "systemInstruction": {
    "parts": [
      {
        "text": "You are an expert at analyzing transcripts."
      }
    ]
  },
  "ttl": "300s"
}' > request.json

curl -X POST "https://generativelanguage.googleapis.com/v1beta/cachedContents?key=$GEMINI_API_KEY" \
 -H 'Content-Type: application/json' \
 -d @request.json \
 > cache.json

CACHE_NAME=$(cat cache.json | grep '"name":' | cut -d '"' -f 4 | head -n 1)

curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=$GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
      "contents": [
        {
          "parts":[{
            "text": "Please summarize this transcript"
          }],
          "role": "user"
        },
      ],
      "cachedContent": "'$CACHE_NAME'"
    }'cache.sh




























                



From name


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
document = client.files.upload(file=media / "a11.txt")
model_name = "gemini-1.5-flash-001"

cache = client.caches.create(
    model=model_name,
    config=types.CreateCachedContentConfig(
        contents=[document],
        system_instruction="You are an expert analyzing transcripts.",
    ),
)
cache_name = cache.name  # Save the name for later

# Later retrieve the cache
cache = client.caches.get(name=cache_name)
response = client.models.generate_content(
    model=model_name,
    contents="Find a lighthearted moment from this transcript",
    config=types.GenerateContentConfig(cached_content=cache.name),
)
print(response.text)cache.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);
const modelName = "gemini-1.5-flash-001";

const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});
const cacheName = cache.name; // Save the name for later

// Later retrieve the cache
const retrievedCache = await ai.caches.get({ name: cacheName });
const response = await ai.models.generateContent({
  model: modelName,
  contents: "Find a lighthearted moment from this transcript",
  config: { cachedContent: retrievedCache.name },
});
console.log("Response text:", response.text);cache.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

modelName := "gemini-1.5-flash-001"
document, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "a11.txt"), 
	&genai.UploadFileConfig{
		MIMEType : "text/plain",
	},
)
if err != nil {
	log.Fatal(err)
}
parts := []*genai.Part{
	genai.NewPartFromURI(document.URI, document.MIMEType),
}
contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}
cache, err := client.Caches.Create(ctx, modelName, &genai.CreateCachedContentConfig{
	Contents:          contents,
	SystemInstruction: genai.NewContentFromText(
		"You are an expert analyzing transcripts.", genai.RoleUser,
	),
})
if err != nil {
	log.Fatal(err)
}
cacheName := cache.Name

// Later retrieve the cache.
cache, err = client.Caches.Get(ctx, cacheName, &genai.GetCachedContentConfig{})
if err != nil {
	log.Fatal(err)
}

response, err := client.Models.GenerateContent(
	ctx,
	modelName,
	genai.Text("Find a lighthearted moment from this transcript"),
	&genai.GenerateContentConfig{
		CachedContent: cache.Name,
	},
)
if err != nil {
	log.Fatal(err)
}
fmt.Println("Response from cache (create from name):")
printResponse(response)cache.go




























                



From chat


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
model_name = "gemini-1.5-flash-001"
system_instruction = "You are an expert analyzing transcripts."

# Create a chat session with the given system instruction.
chat = client.chats.create(
    model=model_name,
    config=types.GenerateContentConfig(system_instruction=system_instruction),
)
document = client.files.upload(file=media / "a11.txt")

response = chat.send_message(
    message=["Hi, could you summarize this transcript?", document]
)
print("\n\nmodel:  ", response.text)
response = chat.send_message(
    message=["Okay, could you tell me more about the trans-lunar injection"]
)
print("\n\nmodel:  ", response.text)

# To cache the conversation so far, pass the chat history as the list of contents.
cache = client.caches.create(
    model=model_name,
    config={
        "contents": chat.get_history(),
        "system_instruction": system_instruction,
    },
)
# Continue the conversation using the cached content.
chat = client.chats.create(
    model=model_name,
    config=types.GenerateContentConfig(cached_content=cache.name),
)
response = chat.send_message(
    message="I didn't understand that last part, could you explain it in simpler language?"
)
print("\n\nmodel:  ", response.text)cache.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = "gemini-1.5-flash-001";
const systemInstruction = "You are an expert analyzing transcripts.";

// Create a chat session with the system instruction.
const chat = ai.chats.create({
  model: modelName,
  config: { systemInstruction: systemInstruction },
});
const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);

let response = await chat.sendMessage({
  message: createUserContent([
    "Hi, could you summarize this transcript?",
    createPartFromUri(document.uri, document.mimeType),
  ]),
});
console.log("\n\nmodel:", response.text);

response = await chat.sendMessage({
  message: "Okay, could you tell me more about the trans-lunar injection",
});
console.log("\n\nmodel:", response.text);

// To cache the conversation so far, pass the chat history as the list of contents.
const chatHistory = chat.getHistory();
const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: chatHistory,
    systemInstruction: systemInstruction,
  },
});

// Continue the conversation using the cached content.
const chatWithCache = ai.chats.create({
  model: modelName,
  config: { cachedContent: cache.name },
});
response = await chatWithCache.sendMessage({
  message:
    "I didn't understand that last part, could you explain it in simpler language?",
});
console.log("\n\nmodel:", response.text);cache.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

modelName := "gemini-1.5-flash-001"
systemInstruction := "You are an expert analyzing transcripts."

// Create initial chat with a system instruction.
chat, err := client.Chats.Create(ctx, modelName, &genai.GenerateContentConfig{
	SystemInstruction: genai.NewContentFromText(systemInstruction, genai.RoleUser),
}, nil)
if err != nil {
	log.Fatal(err)
}

document, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "a11.txt"), 
	&genai.UploadFileConfig{
		MIMEType : "text/plain",
	},
)
if err != nil {
	log.Fatal(err)
}

// Send first message with the transcript.
parts := make([]genai.Part, 2)
parts[0] = genai.Part{Text: "Hi, could you summarize this transcript?"}
parts[1] = genai.Part{
	FileData: &genai.FileData{
		FileURI :      document.URI,
		MIMEType: document.MIMEType,
	},
}

// Send chat message.
resp, err := chat.SendMessage(ctx, parts...)
if err != nil {
	log.Fatal(err)
}
fmt.Println("\n\nmodel: ", resp.Text())

resp, err = chat.SendMessage(
	ctx, 
	genai.Part{
		Text: "Okay, could you tell me more about the trans-lunar injection",
	},
)
if err != nil {
	log.Fatal(err)
}
fmt.Println("\n\nmodel: ", resp.Text())

// To cache the conversation so far, pass the chat history as the list of contents.
cache, err := client.Caches.Create(ctx, modelName, &genai.CreateCachedContentConfig{
	Contents:          chat.History(false),
	SystemInstruction: genai.NewContentFromText(systemInstruction, genai.RoleUser),
})
if err != nil {
	log.Fatal(err)
}

// Continue the conversation using the cached history.
chat, err = client.Chats.Create(ctx, modelName, &genai.GenerateContentConfig{
	CachedContent: cache.Name,
}, nil)
if err != nil {
	log.Fatal(err)
}

resp, err = chat.SendMessage(
	ctx, 
	genai.Part{
		Text: "I didn't understand that last part, could you explain it in simpler language?",
	},
)
if err != nil {
	log.Fatal(err)
}
fmt.Println("\n\nmodel: ", resp.Text())cache.go




























                








Response body
If successful, the response body contains a newly created instance of CachedContent.




Method: cachedContents.list




EndpointQuery parametersRequest bodyResponse body

JSON representation






Lists CachedContents.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/cachedContents








Query parameters




pageSize


integer



Optional. The maximum number of cached contents to return. The service may return fewer than this value. If unspecified, some default (under maximum) number of items will be returned. The maximum value is 1000; values above 1000 will be coerced to 1000.







pageToken


string



Optional. A page token, received from a previous cachedContents.list call. Provide this to retrieve the subsequent page.When paginating, all other parameters provided to cachedContents.list must match the call that provided the page token.





Request body
The request body must be empty.






Response body

Response with CachedContents list.
If successful, the response body contains data with the following structure:




Fields






cachedContents[]


object (CachedContent)



List of cached contents.







nextPageToken


string



A token, which can be sent as pageToken to retrieve the next page. If this field is omitted, there are no subsequent pages.











JSON representation




{
  "cachedContents": [
    {
      object (CachedContent)
    }
  ],
  "nextPageToken": string
}







Method: cachedContents.get




EndpointPath parametersRequest bodyResponse bodyExample request

Basic






Reads CachedContent resource.




Endpoint


                get
              

https://generativelanguage.googleapis.com/v1beta/{name=cachedContents/*}








Path parameters




name


string



Required. The resource name referring to the content cache entry. Format: cachedContents/{id} It takes the form cachedContents/{cachedcontent}.





Request body
The request body must be empty.



Example request


Python
              






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
document = client.files.upload(file=media / "a11.txt")
model_name = "gemini-1.5-flash-001"

cache = client.caches.create(
    model=model_name,
    config={
        "contents": [document],
        "system_instruction": "You are an expert analyzing transcripts.",
    },
)
print(client.caches.get(name=cache.name))cache.py




























            

Node.js
              






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);
const modelName = "gemini-1.5-flash-001";

const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});
const retrievedCache = await ai.caches.get({ name: cache.name });
console.log("Retrieved Cache:", retrievedCache);cache.js




























            

Go
              






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

modelName := "gemini-1.5-flash-001"
document, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "a11.txt"), 
	&genai.UploadFileConfig{
		MIMEType : "text/plain",
	},
)
if err != nil {
	log.Fatal(err)
}
parts := []*genai.Part{
	genai.NewPartFromURI(document.URI, document.MIMEType),
}
contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

cache, err := client.Caches.Create(ctx, modelName, &genai.CreateCachedContentConfig{
	Contents:          contents,
	SystemInstruction: genai.NewContentFromText(
		"You are an expert analyzing transcripts.", genai.RoleUser,
	),
})
if err != nil {
	log.Fatal(err)
}

cache, err = client.Caches.Get(ctx, cache.Name, &genai.GetCachedContentConfig{})
if err != nil {
	log.Fatal(err)
}
fmt.Println("Retrieved cache:")
fmt.Println(cache)cache.go




























            

Shell
              






  
  














  





  
    
  
  











  









  




  




  curl "https://generativelanguage.googleapis.com/v1beta/$CACHE_NAME?key=$GEMINI_API_KEY"cache.sh




























            






Response body
If successful, the response body contains an instance of CachedContent.




Method: cachedContents.patch




EndpointPath parametersQuery parametersRequest bodyResponse bodyExample request

Basic






Updates CachedContent resource (only expiration is updatable).




Endpoint


                patch
              

https://generativelanguage.googleapis.com/v1beta/{cachedContent.name=cachedContents/*}




PATCH https://generativelanguage.googleapis.com/v1beta/{cachedContent.name=cachedContents/*}



Path parameters




cachedContent.name


string



Output only. Identifier. The resource name referring to the cached content. Format: cachedContents/{id} It takes the form cachedContents/{cachedcontent}.





Query parameters




updateMask


string (FieldMask format)



The list of fields to update.This is a comma-separated list of fully qualified names of fields. Example: "user.displayName,photo".





Request body
The request body contains an instance of CachedContent.



Fields






expiration


Union type



Specifies when this resource will expire. expiration can be only one of the following:




expireTime


string (Timestamp format)



Timestamp in UTC of when this resource is considered expired. This is always provided on output, regardless of what was sent on input.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







ttl


string (Duration format)



Input only. New TTL for this resource, input only.A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".









Example request


Python
              






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types
import datetime

client = genai.Client()
document = client.files.upload(file=media / "a11.txt")
model_name = "gemini-1.5-flash-001"

cache = client.caches.create(
    model=model_name,
    config={
        "contents": [document],
        "system_instruction": "You are an expert analyzing transcripts.",
    },
)

# Update the cache's time-to-live (ttl)
ttl = f"{int(datetime.timedelta(hours=2).total_seconds())}s"
client.caches.update(
    name=cache.name, config=types.UpdateCachedContentConfig(ttl=ttl)
)
print(f"After update:\n {cache}")

# Alternatively, update the expire_time directly
# Update the expire_time directly in valid RFC 3339 format (UTC with a "Z" suffix)
expire_time = (
    (
        datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(minutes=15)
    )
    .isoformat()
    .replace("+00:00", "Z")
)
client.caches.update(
    name=cache.name,
    config=types.UpdateCachedContentConfig(expire_time=expire_time),
)cache.py




























            

Node.js
              






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);
const modelName = "gemini-1.5-flash-001";

const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

let cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});

// Update the cache's time-to-live (ttl)
const ttl = `${2 * 3600}s`; // 2 hours in seconds
cache = await ai.caches.update({
  name: cache.name,
  config: { ttl },
});
console.log("After update (TTL):", cache);

// Alternatively, update the expire_time directly (in RFC 3339 format with a "Z" suffix)
const expireTime = new Date(Date.now() + 15 * 60000)
  .toISOString()
  .replace(/\.\d{3}Z$/, "Z");
cache = await ai.caches.update({
  name: cache.name,
  config: { expireTime: expireTime },
});
console.log("After update (expire_time):", cache);cache.js




























            

Go
              






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

modelName := "gemini-1.5-flash-001"
document, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "a11.txt"), 
	&genai.UploadFileConfig{
		MIMEType : "text/plain",
	},
)
if err != nil {
	log.Fatal(err)
}
parts := []*genai.Part{
	genai.NewPartFromURI(document.URI, document.MIMEType),
}
contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

cache, err := client.Caches.Create(ctx, modelName, &genai.CreateCachedContentConfig{
	Contents:          contents,
	SystemInstruction: genai.NewContentFromText(
		"You are an expert analyzing transcripts.", genai.RoleUser,
	),
})
if err != nil {
	log.Fatal(err)
}

_, err = client.Caches.Delete(ctx, cache.Name, &genai.DeleteCachedContentConfig{})
if err != nil {
	log.Fatal(err)
}
fmt.Println("Cache deleted:", cache.Name)cache.go




























            

Shell
              






  
  














  





  
    
  
  











  









  




  




  curl -X PATCH "https://generativelanguage.googleapis.com/v1beta/$CACHE_NAME?key=$GEMINI_API_KEY" \
 -H 'Content-Type: application/json' \
 -d '{"ttl": "600s"}'cache.sh




























            






Response body
If successful, the response body contains an instance of CachedContent.




Method: cachedContents.delete




EndpointPath parametersRequest bodyResponse bodyExample request

Basic






Deletes CachedContent resource.




Endpoint


                delete
              

https://generativelanguage.googleapis.com/v1beta/{name=cachedContents/*}








Path parameters




name


string



Required. The resource name referring to the content cache entry Format: cachedContents/{id} It takes the form cachedContents/{cachedcontent}.





Request body
The request body must be empty.



Example request


Python
              






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
document = client.files.upload(file=media / "a11.txt")
model_name = "gemini-1.5-flash-001"

cache = client.caches.create(
    model=model_name,
    config={
        "contents": [document],
        "system_instruction": "You are an expert analyzing transcripts.",
    },
)
client.caches.delete(name=cache.name)cache.py




























            

Node.js
              






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);
const modelName = "gemini-1.5-flash-001";

const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});
await ai.caches.delete({ name: cache.name });
console.log("Cache deleted:", cache.name);cache.js




























            

Go
              






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

modelName := "gemini-1.5-flash-001"
document, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "a11.txt"), 
	&genai.UploadFileConfig{
		MIMEType : "text/plain",
	},
)
if err != nil {
	log.Fatal(err)
}
parts := []*genai.Part{
	genai.NewPartFromURI(document.URI, document.MIMEType),
}
contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

cache, err := client.Caches.Create(ctx, modelName, &genai.CreateCachedContentConfig{
	Contents:          contents,
	SystemInstruction: genai.NewContentFromText(
		"You are an expert analyzing transcripts.", genai.RoleUser,
	),
})
if err != nil {
	log.Fatal(err)
}

_, err = client.Caches.Delete(ctx, cache.Name, &genai.DeleteCachedContentConfig{})
if err != nil {
	log.Fatal(err)
}
fmt.Println("Cache deleted:", cache.Name)cache.go




























            

Shell
              






  
  














  





  
    
  
  











  









  




  




  curl -X DELETE "https://generativelanguage.googleapis.com/v1beta/$CACHE_NAME?key=$GEMINI_API_KEY"cache.sh




























            






Response body
If successful, the response body is an empty JSON object.




REST Resource: cachedContents




Resource: CachedContent

JSON representation

Content

JSON representation

Part

JSON representation

Blob

JSON representation

FunctionCall

JSON representation

FunctionResponse

JSON representation

FunctionResponsePart

JSON representation

FunctionResponseBlob

JSON representation

SchedulingFileData

JSON representation

ExecutableCode

JSON representation

LanguageCodeExecutionResult

JSON representation

OutcomeVideoMetadata

JSON representation

MediaResolution

JSON representation

LevelTool

JSON representation

FunctionDeclaration

JSON representation

Schema

JSON representation

TypeBehaviorGoogleSearchRetrieval

JSON representation

DynamicRetrievalConfig

JSON representation

ModeCodeExecutionGoogleSearch

JSON representation

Interval

JSON representation

ComputerUse

JSON representation

EnvironmentUrlContextFileSearch

JSON representation

GoogleMaps

JSON representation

ToolConfig

JSON representation

FunctionCallingConfig

JSON representation

ModeRetrievalConfig

JSON representation

LatLng

JSON representation

UsageMetadata

JSON representation

Methods


Resource: CachedContent



Content that has been preprocessed and can be used in subsequent request to GenerativeService.Cached content can be only used with model it was created for.




Fields






contents[]


object (Content)



Optional. Input only. Immutable. The content to cache.







tools[]


object (Tool)



Optional. Input only. Immutable. A list of Tools the model may use to generate the next response







createTime


string (Timestamp format)



Output only. Creation time of the cache entry.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







updateTime


string (Timestamp format)



Output only. When the cache entry was last updated in UTC time.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







usageMetadata


object (UsageMetadata)



Output only. Metadata on the usage of the cached content.







expiration


Union type



Specifies when this resource will expire. expiration can be only one of the following:




expireTime


string (Timestamp format)



Timestamp in UTC of when this resource is considered expired. This is always provided on output, regardless of what was sent on input.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







ttl


string (Duration format)



Input only. New TTL for this resource, input only.A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".










name


string



Output only. Identifier. The resource name referring to the cached content. Format: cachedContents/{id}







displayName


string



Optional. Immutable. The user-generated meaningful display name of the cached content. Maximum 128 Unicode characters.







model


string



Required. Immutable. The name of the Model to use for cached content Format: models/{model}







systemInstruction


object (Content)



Optional. Input only. Immutable. Developer set system instruction. Currently text only.







toolConfig


object (ToolConfig)



Optional. Input only. Immutable. Tool config. This config is shared for all tools.










JSON representation




{
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
  "createTime": string,
  "updateTime": string,
  "usageMetadata": {
    object (UsageMetadata)
  },

  // expiration
  "expireTime": string,
  "ttl": string
  // Union type
  "name": string,
  "displayName": string,
  "model": string,
  "systemInstruction": {
    object (Content)
  },
  "toolConfig": {
    object (ToolConfig)
  }
}








Content



The base structured datatype containing multi-part content of a message.A Content includes a role field designating the producer of the Content and a parts field containing multi-part data that contains the content of the message turn.




Fields






parts[]


object (Part)



Ordered Parts that constitute a single message. Parts may have different MIME types.







role


string



Optional. The producer of the content. Must be either 'user' or 'model'.Useful to set for multi-turn conversations, otherwise can be left blank or unset.










JSON representation




{
  "parts": [
    {
      object (Part)
    }
  ],
  "role": string
}








Part



A datatype containing media that is part of a multi-part Content message.A Part consists of data which has an associated datatype. A Part can only contain one of the accepted types in Part.data.A Part must have a fixed IANA MIME type identifying the type and subtype of the media if the inlineData field is filled with raw bytes.




Fields






thought


boolean



Optional. Indicates if the part is thought from the model.







thoughtSignature


string (bytes format)



Optional. An opaque signature for the thought so it can be reused in subsequent requests.A base64-encoded string.







partMetadata


object (Struct format)



Custom metadata associated with the Part. Agents using genai.Part as content representation may need to keep track of the additional information. For example it can be name of a file/source from which the Part originates or a way to multiplex multiple Part streams.







mediaResolution


object (MediaResolution)



Optional. Media resolution for the input media.







data


Union type



data can be only one of the following:




text


string



Inline text.







inlineData


object (Blob)



Inline media bytes.







functionCall


object (FunctionCall)



A predicted FunctionCall returned from the model that contains a string representing the FunctionDeclaration.name with the arguments and their values.







functionResponse


object (FunctionResponse)



The result output of a FunctionCall that contains a string representing the FunctionDeclaration.name and a structured JSON object containing any output from the function is used as context to the model.







fileData


object (FileData)



URI based data.







executableCode


object (ExecutableCode)



Code generated by the model that is meant to be executed.







codeExecutionResult


object (CodeExecutionResult)



Result of executing the ExecutableCode.










metadata


Union type



Controls extra preprocessing of data. metadata can be only one of the following:




videoMetadata


object (VideoMetadata)



Optional. Video metadata. The metadata should only be specified while the video data is presented in inlineData or fileData.













JSON representation




{
  "thought": boolean,
  "thoughtSignature": string,
  "partMetadata": {
    object
  },
  "mediaResolution": {
    object (MediaResolution)
  },

  // data
  "text": string,
  "inlineData": {
    object (Blob)
  },
  "functionCall": {
    object (FunctionCall)
  },
  "functionResponse": {
    object (FunctionResponse)
  },
  "fileData": {
    object (FileData)
  },
  "executableCode": {
    object (ExecutableCode)
  },
  "codeExecutionResult": {
    object (CodeExecutionResult)
  }
  // Union type

  // metadata
  "videoMetadata": {
    object (VideoMetadata)
  }
  // Union type
}








Blob



Raw media bytes.Text should not be sent as raw bytes, use the 'text' field.




Fields






mimeType


string



The IANA standard MIME type of the source data. Examples:  - image/png  - image/jpeg If an unsupported MIME type is provided, an error will be returned. For a complete list of supported types, see Supported file formats.







data


string (bytes format)



Raw bytes for media formats.A base64-encoded string.










JSON representation




{
  "mimeType": string,
  "data": string
}








FunctionCall



A predicted FunctionCall returned from the model that contains a string representing the FunctionDeclaration.name with the arguments and their values.




Fields






id


string



Optional. The unique id of the function call. If populated, the client to execute the functionCall and return the response with the matching id.







name


string



Required. The name of the function to call. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.







args


object (Struct format)



Optional. The function parameters and values in JSON object format.










JSON representation




{
  "id": string,
  "name": string,
  "args": {
    object
  }
}








FunctionResponse



The result output from a FunctionCall that contains a string representing the FunctionDeclaration.name and a structured JSON object containing any output from the function is used as context to the model. This should contain the result of aFunctionCall made based on model prediction.




Fields






id


string



Optional. The id of the function call this response is for. Populated by the client to match the corresponding function call id.







name


string



Required. The name of the function to call. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.







response


object (Struct format)



Required. The function response in JSON object format. Callers can use any keys of their choice that fit the function's syntax to return the function output, e.g. "output", "result", etc. In particular, if the function call failed to execute, the response can have an "error" key to return error details to the model.







parts[]


object (FunctionResponsePart)



Optional. Ordered Parts that constitute a function response. Parts may have different IANA MIME types.







willContinue


boolean



Optional. Signals that function call continues, and more responses will be returned, turning the function call into a generator. Is only applicable to NON_BLOCKING function calls, is ignored otherwise. If set to false, future responses will not be considered. It is allowed to return empty response with willContinue=False to signal that the function call is finished. This may still trigger the model generation. To avoid triggering the generation and finish the function call, additionally set scheduling to SILENT.







scheduling


enum (Scheduling)



Optional. Specifies how the response should be scheduled in the conversation. Only applicable to NON_BLOCKING function calls, is ignored otherwise. Defaults to WHEN_IDLE.










JSON representation




{
  "id": string,
  "name": string,
  "response": {
    object
  },
  "parts": [
    {
      object (FunctionResponsePart)
    }
  ],
  "willContinue": boolean,
  "scheduling": enum (Scheduling)
}








FunctionResponsePart



A datatype containing media that is part of a FunctionResponse message.A FunctionResponsePart consists of data which has an associated datatype. A FunctionResponsePart can only contain one of the accepted types in FunctionResponsePart.data.A FunctionResponsePart must have a fixed IANA MIME type identifying the type and subtype of the media if the inlineData field is filled with raw bytes.




Fields






data


Union type



The data of the function response part. data can be only one of the following:




inlineData


object (FunctionResponseBlob)



Inline media bytes.













JSON representation




{

  // data
  "inlineData": {
    object (FunctionResponseBlob)
  }
  // Union type
}








FunctionResponseBlob



Raw media bytes for function response.Text should not be sent as raw bytes, use the 'FunctionResponse.response' field.




Fields






mimeType


string



The IANA standard MIME type of the source data. Examples:  - image/png  - image/jpeg If an unsupported MIME type is provided, an error will be returned. For a complete list of supported types, see Supported file formats.







data


string (bytes format)



Raw bytes for media formats.A base64-encoded string.










JSON representation




{
  "mimeType": string,
  "data": string
}








Scheduling

Specifies how the response should be scheduled in the conversation.









Enums




SCHEDULING_UNSPECIFIED
This value is unused.


SILENT
Only add the result to the conversation context, do not interrupt or trigger generation.


WHEN_IDLE
Add the result to the conversation context, and prompt to generate output without interrupting ongoing generation.


INTERRUPT
Add the result to the conversation context, interrupt ongoing generation and prompt to generate output.






FileData



URI based data.




Fields






mimeType


string



Optional. The IANA standard MIME type of the source data.







fileUri


string



Required. URI.










JSON representation




{
  "mimeType": string,
  "fileUri": string
}








ExecutableCode



Code generated by the model that is meant to be executed, and the result returned to the model.Only generated when using the CodeExecution tool, in which the code will be automatically executed, and a corresponding CodeExecutionResult will also be generated.




Fields






language


enum (Language)



Required. Programming language of the code.







code


string



Required. The code to be executed.










JSON representation




{
  "language": enum (Language),
  "code": string
}








Language

Supported programming languages for the generated code.









Enums




LANGUAGE_UNSPECIFIED
Unspecified language. This value should not be used.


PYTHON
Python >= 3.10, with numpy and simpy available. Python is the default language.






CodeExecutionResult



Result of executing the ExecutableCode.Only generated when using the CodeExecution, and always follows a part containing the ExecutableCode.




Fields






outcome


enum (Outcome)



Required. Outcome of the code execution.







output


string



Optional. Contains stdout when code execution is successful, stderr or other description otherwise.










JSON representation




{
  "outcome": enum (Outcome),
  "output": string
}








Outcome

Enumeration of possible outcomes of the code execution.









Enums




OUTCOME_UNSPECIFIED
Unspecified status. This value should not be used.


OUTCOME_OK
Code execution completed successfully.


OUTCOME_FAILED
Code execution finished but with a failure. stderr should contain the reason.


OUTCOME_DEADLINE_EXCEEDED
Code execution ran for too long, and was cancelled. There may or may not be a partial output present.






VideoMetadata



Metadata describes the input video content.




Fields






startOffset


string (Duration format)



Optional. The start offset of the video.A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".







endOffset


string (Duration format)



Optional. The end offset of the video.A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".







fps


number



Optional. The frame rate of the video sent to the model. If not specified, the default value will be 1.0. The fps range is (0.0, 24.0].










JSON representation




{
  "startOffset": string,
  "endOffset": string,
  "fps": number
}








MediaResolution



Media resolution for the input media.




Fields






value


Union type



value can be only one of the following:




level


enum (Level)
















JSON representation




{

  // value
  "level": enum (Level)
  // Union type
}








Level










Enums




MEDIA_RESOLUTION_UNSPECIFIED
Media resolution has not been set.


MEDIA_RESOLUTION_LOW
Media resolution set to low.


MEDIA_RESOLUTION_MEDIUM
Media resolution set to medium.


MEDIA_RESOLUTION_HIGH
Media resolution set to high.






Tool



Tool details that the model may use to generate response.A Tool is a piece of code that enables the system to interact with external systems to perform an action, or set of actions, outside of knowledge and scope of the model.




Fields






functionDeclarations[]


object (FunctionDeclaration)



Optional. A list of FunctionDeclarations available to the model that can be used for function calling.The model or system does not execute the function. Instead the defined function may be returned as a FunctionCall with arguments to the client side for execution. The model may decide to call a subset of these functions by populating FunctionCall in the response. The next conversation turn may contain a FunctionResponse with the Content.role "function" generation context for the next model turn.







googleSearchRetrieval


object (GoogleSearchRetrieval)



Optional. Retrieval tool that is powered by Google search.







codeExecution


object (CodeExecution)



Optional. Enables the model to execute code as part of generation.







googleSearch


object (GoogleSearch)



Optional. GoogleSearch tool type. Tool to support Google Search in Model. Powered by Google.







computerUse


object (ComputerUse)



Optional. Tool to support the model interacting directly with the computer. If enabled, it automatically populates computer-use specific Function Declarations.







urlContext


object (UrlContext)



Optional. Tool to support URL context retrieval.







fileSearch


object (FileSearch)



Optional. FileSearch tool type. Tool to retrieve knowledge from Semantic Retrieval corpora.







googleMaps


object (GoogleMaps)



Optional. Tool that allows grounding the model's response with geospatial context related to the user's query.










JSON representation




{
  "functionDeclarations": [
    {
      object (FunctionDeclaration)
    }
  ],
  "googleSearchRetrieval": {
    object (GoogleSearchRetrieval)
  },
  "codeExecution": {
    object (CodeExecution)
  },
  "googleSearch": {
    object (GoogleSearch)
  },
  "computerUse": {
    object (ComputerUse)
  },
  "urlContext": {
    object (UrlContext)
  },
  "fileSearch": {
    object (FileSearch)
  },
  "googleMaps": {
    object (GoogleMaps)
  }
}








FunctionDeclaration



Structured representation of a function declaration as defined by the OpenAPI 3.03 specification. Included in this declaration are the function name and parameters. This FunctionDeclaration is a representation of a block of code that can be used as a Tool by the model and executed by the client.




Fields






name


string



Required. The name of the function. Must be a-z, A-Z, 0-9, or contain underscores, colons, dots, and dashes, with a maximum length of 64.







description


string



Required. A brief description of the function.







behavior


enum (Behavior)



Optional. Specifies the function Behavior. Currently only supported by the BidiGenerateContent method.







parameters


object (Schema)



Optional. Describes the parameters to this function. Reflects the Open API 3.03 Parameter Object string Key: the name of the parameter. Parameter names are case sensitive. Schema Value: the Schema defining the type used for the parameter.







parametersJsonSchema


value (Value format)



Optional. Describes the parameters to the function in JSON Schema format. The schema must describe an object where the properties are the parameters to the function. For example:
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "integer" }
  },
  "additionalProperties": false,
  "required": ["name", "age"],
  "propertyOrdering": ["name", "age"]
}

This field is mutually exclusive with parameters.







response


object (Schema)



Optional. Describes the output from this function in JSON Schema format. Reflects the Open API 3.03 Response Object. The Schema defines the type used for the response value of the function.







responseJsonSchema


value (Value format)



Optional. Describes the output from this function in JSON Schema format. The value specified by the schema is the response value of the function.This field is mutually exclusive with response.










JSON representation




{
  "name": string,
  "description": string,
  "behavior": enum (Behavior),
  "parameters": {
    object (Schema)
  },
  "parametersJsonSchema": value,
  "response": {
    object (Schema)
  },
  "responseJsonSchema": value
}








Schema



The Schema object allows the definition of input and output data types. These types can be objects, but also primitives and arrays. Represents a select subset of an OpenAPI 3.0 schema object.




Fields






type


enum (Type)



Required. Data type.







format


string



Optional. The format of the data. Any value is allowed, but most do not trigger any special functionality.







title


string



Optional. The title of the schema.







description


string



Optional. A brief description of the parameter. This could contain examples of use. Parameter description may be formatted as Markdown.







nullable


boolean



Optional. Indicates if the value may be null.







enum[]


string



Optional. Possible values of the element of Type.STRING with enum format. For example we can define an Enum Direction as : {type:STRING, format:enum, enum:["EAST", NORTH", "SOUTH", "WEST"]}







maxItems


string (int64 format)



Optional. Maximum number of the elements for Type.ARRAY.







minItems


string (int64 format)



Optional. Minimum number of the elements for Type.ARRAY.







properties


map (key: string, value: object (Schema))



Optional. Properties of Type.OBJECT.An object containing a list of "key": value pairs. Example: { "name": "wrench", "mass": "1.3kg", "count": "3" }.







required[]


string



Optional. Required properties of Type.OBJECT.







minProperties


string (int64 format)



Optional. Minimum number of the properties for Type.OBJECT.







maxProperties


string (int64 format)



Optional. Maximum number of the properties for Type.OBJECT.







minLength


string (int64 format)



Optional. SCHEMA FIELDS FOR TYPE STRING Minimum length of the Type.STRING







maxLength


string (int64 format)



Optional. Maximum length of the Type.STRING







pattern


string



Optional. Pattern of the Type.STRING to restrict a string to a regular expression.







example


value (Value format)



Optional. Example of the object. Will only populated when the object is the root.







anyOf[]


object (Schema)



Optional. The value should be validated against any (one or more) of the subschemas in the list.







propertyOrdering[]


string



Optional. The order of the properties. Not a standard field in open api spec. Used to determine the order of the properties in the response.







default


value (Value format)



Optional. Default value of the field. Per JSON Schema, this field is intended for documentation generators and doesn't affect validation. Thus it's included here and ignored so that developers who send schemas with a default field don't get unknown-field errors.







items


object (Schema)



Optional. Schema of the elements of Type.ARRAY.







minimum


number



Optional. SCHEMA FIELDS FOR TYPE INTEGER and NUMBER Minimum value of the Type.INTEGER and Type.NUMBER







maximum


number



Optional. Maximum value of the Type.INTEGER and Type.NUMBER










JSON representation




{
  "type": enum (Type),
  "format": string,
  "title": string,
  "description": string,
  "nullable": boolean,
  "enum": [
    string
  ],
  "maxItems": string,
  "minItems": string,
  "properties": {
    string: {
      object (Schema)
    },
    ...
  },
  "required": [
    string
  ],
  "minProperties": string,
  "maxProperties": string,
  "minLength": string,
  "maxLength": string,
  "pattern": string,
  "example": value,
  "anyOf": [
    {
      object (Schema)
    }
  ],
  "propertyOrdering": [
    string
  ],
  "default": value,
  "items": {
    object (Schema)
  },
  "minimum": number,
  "maximum": number
}








Type

Type contains the list of OpenAPI data types as defined by https://spec.openapis.org/oas/v3.0.3#data-types









Enums




TYPE_UNSPECIFIED
Not specified, should not be used.


STRING
String type.


NUMBER
Number type.


INTEGER
Integer type.


BOOLEAN
Boolean type.


ARRAY
Array type.


OBJECT
Object type.


NULL
Null type.






Behavior

Defines the function behavior. Defaults to BLOCKING.









Enums




UNSPECIFIED
This value is unused.


BLOCKING
If set, the system will wait to receive the function response before continuing the conversation.


NON_BLOCKING
If set, the system will not wait to receive the function response. Instead, it will attempt to handle function responses as they become available while maintaining the conversation between the user and the model.






GoogleSearchRetrieval



Tool to retrieve public web data for grounding, powered by Google.




Fields






dynamicRetrievalConfig


object (DynamicRetrievalConfig)



Specifies the dynamic retrieval configuration for the given source.










JSON representation




{
  "dynamicRetrievalConfig": {
    object (DynamicRetrievalConfig)
  }
}








DynamicRetrievalConfig



Describes the options to customize dynamic retrieval.




Fields






mode


enum (Mode)



The mode of the predictor to be used in dynamic retrieval.







dynamicThreshold


number



The threshold to be used in dynamic retrieval. If not set, a system default value is used.










JSON representation




{
  "mode": enum (Mode),
  "dynamicThreshold": number
}








Mode

The mode of the predictor to be used in dynamic retrieval.









Enums




MODE_UNSPECIFIED
Always trigger retrieval.


MODE_DYNAMIC
Run retrieval only when system decides it is necessary.






CodeExecution
This type has no fields.



Tool that executes code generated by the model, and automatically returns the result to the model.See also ExecutableCode and CodeExecutionResult which are only generated when using this tool.





GoogleSearch



GoogleSearch tool type. Tool to support Google Search in Model. Powered by Google.




Fields






timeRangeFilter


object (Interval)



Optional. Filter search results to a specific time range. If customers set a start time, they must set an end time (and vice versa).










JSON representation




{
  "timeRangeFilter": {
    object (Interval)
  }
}








Interval



Represents a time interval, encoded as a Timestamp start (inclusive) and a Timestamp end (exclusive).The start must be less than or equal to the end. When the start equals the end, the interval is empty (matches no time). When both start and end are unspecified, the interval matches any time.




Fields






startTime


string (Timestamp format)



Optional. Inclusive start of the interval.If specified, a Timestamp matching this interval will have to be the same or after the start.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".







endTime


string (Timestamp format)



Optional. Exclusive end of the interval.If specified, a Timestamp matching this interval will have to be before the end.Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".










JSON representation




{
  "startTime": string,
  "endTime": string
}








ComputerUse



Computer Use tool type.




Fields






environment


enum (Environment)



Required. The environment being operated.







excludedPredefinedFunctions[]


string



Optional. By default, predefined functions are included in the final model call. Some of them can be explicitly excluded from being automatically included. This can serve two purposes: 1. Using a more restricted / different action space. 2. Improving the definitions / instructions of predefined functions.










JSON representation




{
  "environment": enum (Environment),
  "excludedPredefinedFunctions": [
    string
  ]
}








Environment

Represents the environment being operated, such as a web browser.









Enums




ENVIRONMENT_UNSPECIFIED
Defaults to browser.


ENVIRONMENT_BROWSER
Operates in a web browser.






UrlContext
This type has no fields.



Tool to support URL context retrieval.





FileSearch



The FileSearch tool that retrieves knowledge from Semantic Retrieval corpora. Files are imported to Semantic Retrieval corpora using the ImportFile API.




Fields






fileSearchStoreNames[]


string



Required. The names of the fileSearchStores to retrieve from. Example: fileSearchStores/my-file-search-store-123







metadataFilter


string



Optional. Metadata filter to apply to the semantic retrieval documents and chunks.







topK


integer



Optional. The number of semantic retrieval chunks to retrieve.










JSON representation




{
  "fileSearchStoreNames": [
    string
  ],
  "metadataFilter": string,
  "topK": integer
}








GoogleMaps



The GoogleMaps Tool that provides geospatial context for the user's query.




Fields






enableWidget


boolean



Optional. Whether to return a widget context token in the GroundingMetadata of the response. Developers can use the widget context token to render a Google Maps widget with geospatial context related to the places that the model references in the response.










JSON representation




{
  "enableWidget": boolean
}








ToolConfig



The Tool configuration containing parameters for specifying Tool use in the request.




Fields






functionCallingConfig


object (FunctionCallingConfig)



Optional. Function calling config.







retrievalConfig


object (RetrievalConfig)



Optional. Retrieval config.










JSON representation




{
  "functionCallingConfig": {
    object (FunctionCallingConfig)
  },
  "retrievalConfig": {
    object (RetrievalConfig)
  }
}








FunctionCallingConfig



Configuration for specifying function calling behavior.




Fields






mode


enum (Mode)



Optional. Specifies the mode in which function calling should execute. If unspecified, the default value will be set to AUTO.







allowedFunctionNames[]


string



Optional. A set of function names that, when provided, limits the functions the model will call.This should only be set when the Mode is ANY or VALIDATED. Function names should match [FunctionDeclaration.name]. When set, model will predict a function call from only allowed function names.










JSON representation




{
  "mode": enum (Mode),
  "allowedFunctionNames": [
    string
  ]
}








Mode

Defines the execution behavior for function calling by defining the execution mode.









Enums




MODE_UNSPECIFIED
Unspecified function calling mode. This value should not be used.


AUTO
Default model behavior, model decides to predict either a function call or a natural language response.


ANY
Model is constrained to always predicting a function call only. If "allowedFunctionNames" are set, the predicted function call will be limited to any one of "allowedFunctionNames", else the predicted function call will be any one of the provided "functionDeclarations".


NONE
Model will not predict any function call. Model behavior is same as when not passing any function declarations.


VALIDATED
Model decides to predict either a function call or a natural language response, but will validate function calls with constrained decoding. If "allowedFunctionNames" are set, the predicted function call will be limited to any one of "allowedFunctionNames", else the predicted function call will be any one of the provided "functionDeclarations".






RetrievalConfig



Retrieval config.




Fields






latLng


object (LatLng)



Optional. The location of the user.







languageCode


string



Optional. The language code of the user. Language code for content. Use language tags defined by BCP47.










JSON representation




{
  "latLng": {
    object (LatLng)
  },
  "languageCode": string
}








LatLng



An object that represents a latitude/longitude pair. This is expressed as a pair of doubles to represent degrees latitude and degrees longitude. Unless specified otherwise, this object must conform to the  WGS84 standard. Values must be within normalized ranges.




Fields






latitude


number



The latitude in degrees. It must be in the range [-90.0, +90.0].







longitude


number



The longitude in degrees. It must be in the range [-180.0, +180.0].










JSON representation




{
  "latitude": number,
  "longitude": number
}








UsageMetadata



Metadata on the usage of the cached content.




Fields






totalTokenCount


integer



Total number of tokens that the cached content consumes.










JSON representation




{
  "totalTokenCount": integer
}









  

  
