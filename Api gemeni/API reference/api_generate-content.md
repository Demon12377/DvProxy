# Generating content

Source: https://ai.google.dev/api/generate-content

==================



  
    
    The Gemini API supports content generation with images, audio, code, tools, and more. For details on each of these features, read on and check out the task-focused sample code, or read the comprehensive guides.

Text generation
Vision
Audio
Embeddings
Long context
Code execution
JSON Mode
Function calling
System instructions


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
    Method: models.generateContent




EndpointPath parametersRequest body

JSON representation

Response bodyAuthorization scopesExample request

TextImageAudioVideoPDFChatCacheTuned ModelJSON ModeCode executionFunction CallingGeneration configSafety SettingsSystem Instruction






Generates a model response given an input GenerateContentRequest. Refer to the text generation guide for detailed usage information. Input capabilities differ between models, including tuned models. Refer to the model guide and tuning guide for details.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateContent








Path parameters




model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}. It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






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







Example request


Text


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
response = client.models.generate_content(
    model="gemini-2.0-flash", contents="Write a story about a magic backpack."
)
print(response.text)text_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Write a story about a magic backpack.",
});
console.log(response.text);text_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}
contents := []*genai.Content{
	genai.NewContentFromText("Write a story about a magic backpack.", genai.RoleUser),
}
response, err := client.Models.GenerateContent(ctx, "gemini-2.0-flash", contents, nil)
if err != nil {
	log.Fatal(err)
}
printResponse(response)text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [{
        "parts":[{"text": "Write a story about a magic backpack."}]
        }]
       }' 2> /dev/nulltext_generation.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

GenerateContentResponse response =
        client.models.generateContent(
                "gemini-2.0-flash",
                "Write a story about a magic backpack.",
                null);

System.out.println(response.text());TextGeneration.java




























                



Image


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
import PIL.Image

client = genai.Client()
organ = PIL.Image.open(media / "organ.jpg")
response = client.models.generate_content(
    model="gemini-2.0-flash", contents=["Tell me about this instrument", organ]
)
print(response.text)text_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const organ = await ai.files.upload({
  file: path.join(media, "organ.jpg"),
});

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: [
    createUserContent([
      "Tell me about this instrument", 
      createPartFromUri(organ.uri, organ.mimeType)
    ]),
  ],
});
console.log(response.text);text_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "organ.jpg"), 
	&genai.UploadFileConfig{
		MIMEType : "image/jpeg",
	},
)
if err != nil {
	log.Fatal(err)
}
parts := []*genai.Part{
	genai.NewPartFromText("Tell me about this instrument"),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}
contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

response, err := client.Models.GenerateContent(ctx, "gemini-2.0-flash", contents, nil)
if err != nil {
	log.Fatal(err)
}
printResponse(response)text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  # Use a temporary file to hold the base64 encoded image data
TEMP_B64=$(mktemp)
trap 'rm -f "$TEMP_B64"' EXIT
base64 $B64FLAGS $IMG_PATH > "$TEMP_B64"

# Use a temporary file to hold the JSON payload
TEMP_JSON=$(mktemp)
trap 'rm -f "$TEMP_JSON"' EXIT

cat > "$TEMP_JSON" << EOF
{
  "contents": [{
    "parts":[
      {"text": "Tell me about this instrument"},
      {
        "inline_data": {
          "mime_type":"image/jpeg",
          "data": "$(cat "$TEMP_B64")"
        }
      }
    ]
  }]
}
EOF

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d "@$TEMP_JSON" 2> /dev/nulltext_generation.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

String path = media_path + "organ.jpg";
byte[] imageData = Files.readAllBytes(Paths.get(path));

Content content =
        Content.fromParts(
                Part.fromText("Tell me about this instrument."),
                Part.fromBytes(imageData, "image/jpeg"));

GenerateContentResponse response = client.models.generateContent("gemini-2.0-flash", content, null);

System.out.println(response.text());TextGeneration.java




























                



Audio


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
sample_audio = client.files.upload(file=media / "sample.mp3")
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["Give me a summary of this audio file.", sample_audio],
)
print(response.text)text_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const audio = await ai.files.upload({
  file: path.join(media, "sample.mp3"),
});

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: [
    createUserContent([
      "Give me a summary of this audio file.",
      createPartFromUri(audio.uri, audio.mimeType),
    ]),
  ],
});
console.log(response.text);text_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "sample.mp3"), 
	&genai.UploadFileConfig{
		MIMEType : "audio/mpeg",
	},
)
if err != nil {
	log.Fatal(err)
}

parts := []*genai.Part{
	genai.NewPartFromText("Give me a summary of this audio file."),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}

contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

response, err := client.Models.GenerateContent(ctx, "gemini-2.0-flash", contents, nil)
if err != nil {
	log.Fatal(err)
}
printResponse(response)text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  # Use File API to upload audio data to API request.
MIME_TYPE=$(file -b --mime-type "${AUDIO_PATH}")
NUM_BYTES=$(wc -c < "${AUDIO_PATH}")
DISPLAY_NAME=AUDIO

tmp_header_file=upload-header.tmp

# Initial resumable request defining metadata.
# The upload url is in the response headers dump them to a file.
curl "${BASE_URL}/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -D upload-header.tmp \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \
  -d "{'file': {'display_name': '${DISPLAY_NAME}'}}" 2> /dev/null

upload_url=$(grep -i "x-goog-upload-url: " "${tmp_header_file}" | cut -d" " -f2 | tr -d "\r")
rm "${tmp_header_file}"

# Upload the actual bytes.
curl "${upload_url}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${AUDIO_PATH}" 2> /dev/null > file_info.json

file_uri=$(jq ".file.uri" file_info.json)
echo file_uri=$file_uri

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [{
        "parts":[
          {"text": "Please describe this file."},
          {"file_data":{"mime_type": "audio/mpeg", "file_uri": '$file_uri'}}]
        }]
       }' 2> /dev/null > response.json

cat response.json
echo

jq ".candidates[].content.parts[].text" response.jsontext_generation.sh




























                



Video


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
import time

client = genai.Client()
# Video clip (CC BY 3.0) from https://peach.blender.org/download/
myfile = client.files.upload(file=media / "Big_Buck_Bunny.mp4")
print(f"{myfile=}")

# Poll until the video file is completely processed (state becomes ACTIVE).
while not myfile.state or myfile.state.name != "ACTIVE":
    print("Processing video...")
    print("File state:", myfile.state)
    time.sleep(5)
    myfile = client.files.get(name=myfile.name)

response = client.models.generate_content(
    model="gemini-2.0-flash", contents=[myfile, "Describe this video clip"]
)
print(f"{response.text=}")text_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let video = await ai.files.upload({
  file: path.join(media, 'Big_Buck_Bunny.mp4'),
});

// Poll until the video file is completely processed (state becomes ACTIVE).
while (!video.state || video.state.toString() !== 'ACTIVE') {
  console.log('Processing video...');
  console.log('File state: ', video.state);
  await sleep(5000);
  video = await ai.files.get({name: video.name});
}

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: [
    createUserContent([
      "Describe this video clip",
      createPartFromUri(video.uri, video.mimeType),
    ]),
  ],
});
console.log(response.text);text_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "Big_Buck_Bunny.mp4"), 
	&genai.UploadFileConfig{
		MIMEType : "video/mp4",
	},
)
if err != nil {
	log.Fatal(err)
}

// Poll until the video file is completely processed (state becomes ACTIVE).
for file.State == genai.FileStateUnspecified || file.State != genai.FileStateActive {
	fmt.Println("Processing video...")
	fmt.Println("File state:", file.State)
	time.Sleep(5 * time.Second)

	file, err = client.Files.Get(ctx, file.Name, nil)
	if err != nil {
		log.Fatal(err)
	}
}

parts := []*genai.Part{
	genai.NewPartFromText("Describe this video clip"),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}

contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

response, err := client.Models.GenerateContent(ctx, "gemini-2.0-flash", contents, nil)
if err != nil {
	log.Fatal(err)
}
printResponse(response)text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  # Use File API to upload audio data to API request.
MIME_TYPE=$(file -b --mime-type "${VIDEO_PATH}")
NUM_BYTES=$(wc -c < "${VIDEO_PATH}")
DISPLAY_NAME=VIDEO

# Initial resumable request defining metadata.
# The upload url is in the response headers dump them to a file.
curl "${BASE_URL}/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -D "${tmp_header_file}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \
  -d "{'file': {'display_name': '${DISPLAY_NAME}'}}" 2> /dev/null

upload_url=$(grep -i "x-goog-upload-url: " "${tmp_header_file}" | cut -d" " -f2 | tr -d "\r")
rm "${tmp_header_file}"

# Upload the actual bytes.
curl "${upload_url}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${VIDEO_PATH}" 2> /dev/null > file_info.json

file_uri=$(jq ".file.uri" file_info.json)
echo file_uri=$file_uri

state=$(jq ".file.state" file_info.json)
echo state=$state

name=$(jq ".file.name" file_info.json)
echo name=$name

while [[ "($state)" = *"PROCESSING"* ]];
do
  echo "Processing video..."
  sleep 5
  # Get the file of interest to check state
  curl https://generativelanguage.googleapis.com/v1beta/files/$name > file_info.json
  state=$(jq ".file.state" file_info.json)
done

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [{
        "parts":[
          {"text": "Transcribe the audio from this video, giving timestamps for salient events in the video. Also provide visual descriptions."},
          {"file_data":{"mime_type": "video/mp4", "file_uri": '$file_uri'}}]
        }]
       }' 2> /dev/null > response.json

cat response.json
echo

jq ".candidates[].content.parts[].text" response.jsontext_generation.sh




























                



PDF


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
sample_pdf = client.files.upload(file=media / "test.pdf")
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["Give me a summary of this document:", sample_pdf],
)
print(f"{response.text=}")text_generation.py




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "test.pdf"), 
	&genai.UploadFileConfig{
		MIMEType : "application/pdf",
	},
)
if err != nil {
	log.Fatal(err)
}

parts := []*genai.Part{
	genai.NewPartFromText("Give me a summary of this document:"),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}

contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

response, err := client.Models.GenerateContent(ctx, "gemini-2.0-flash", contents, nil)
if err != nil {
	log.Fatal(err)
}
printResponse(response)text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  MIME_TYPE=$(file -b --mime-type "${PDF_PATH}")
NUM_BYTES=$(wc -c < "${PDF_PATH}")
DISPLAY_NAME=TEXT


echo $MIME_TYPE
tmp_header_file=upload-header.tmp

# Initial resumable request defining metadata.
# The upload url is in the response headers dump them to a file.
curl "${BASE_URL}/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -D upload-header.tmp \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \
  -d "{'file': {'display_name': '${DISPLAY_NAME}'}}" 2> /dev/null

upload_url=$(grep -i "x-goog-upload-url: " "${tmp_header_file}" | cut -d" " -f2 | tr -d "\r")
rm "${tmp_header_file}"

# Upload the actual bytes.
curl "${upload_url}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${PDF_PATH}" 2> /dev/null > file_info.json

file_uri=$(jq ".file.uri" file_info.json)
echo file_uri=$file_uri

# Now generate content using that file
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [{
        "parts":[
          {"text": "Can you add a few more lines to this poem?"},
          {"file_data":{"mime_type": "application/pdf", "file_uri": '$file_uri'}}]
        }]
       }' 2> /dev/null > response.json

cat response.json
echo

jq ".candidates[].content.parts[].text" response.jsontext_generation.sh




























                



Chat


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
# Pass initial history using the "history" argument
chat = client.chats.create(
    model="gemini-2.0-flash",
    history=[
        types.Content(role="user", parts=[types.Part(text="Hello")]),
        types.Content(
            role="model",
            parts=[
                types.Part(
                    text="Great to meet you. What would you like to know?"
                )
            ],
        ),
    ],
)
response = chat.send_message(message="I have 2 dogs in my house.")
print(response.text)
response = chat.send_message(message="How many paws are in my house?")
print(response.text)chat.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  history: [
    {
      role: "user",
      parts: [{ text: "Hello" }],
    },
    {
      role: "model",
      parts: [{ text: "Great to meet you. What would you like to know?" }],
    },
  ],
});

const response1 = await chat.sendMessage({
  message: "I have 2 dogs in my house.",
});
console.log("Chat response 1:", response1.text);

const response2 = await chat.sendMessage({
  message: "How many paws are in my house?",
});
console.log("Chat response 2:", response2.text);chat.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

// Pass initial history using the History field.
history := []*genai.Content{
	genai.NewContentFromText("Hello", genai.RoleUser),
	genai.NewContentFromText("Great to meet you. What would you like to know?", genai.RoleModel),
}

chat, err := client.Chats.Create(ctx, "gemini-2.0-flash", nil, history)
if err != nil {
	log.Fatal(err)
}

firstResp, err := chat.SendMessage(ctx, genai.Part{Text: "I have 2 dogs in my house."})
if err != nil {
	log.Fatal(err)
}
fmt.Println(firstResp.Text())

secondResp, err := chat.SendMessage(ctx, genai.Part{Text: "How many paws are in my house?"})
if err != nil {
	log.Fatal(err)
}
fmt.Println(secondResp.Text())chat.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [
        {"role":"user",
         "parts":[{
           "text": "Hello"}]},
        {"role": "model",
         "parts":[{
           "text": "Great to meet you. What would you like to know?"}]},
        {"role":"user",
         "parts":[{
           "text": "I have two dogs in my house. How many paws are in my house?"}]},
      ]
    }' 2> /dev/null | grep "text"chat.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

Content userContent = Content.fromParts(Part.fromText("Hello"));
Content modelContent =
        Content.builder()
                .role("model")
                .parts(
                        Collections.singletonList(
                                Part.fromText("Great to meet you. What would you like to know?")
                        )
                ).build();

Chat chat = client.chats.create(
        "gemini-2.0-flash",
        GenerateContentConfig.builder()
                .systemInstruction(userContent)
                .systemInstruction(modelContent)
                .build()
);

GenerateContentResponse response1 = chat.sendMessage("I have 2 dogs in my house.");
System.out.println(response1.text());

GenerateContentResponse response2 = chat.sendMessage("How many paws are in my house?");
System.out.println(response2.text());
ChatSession.java




























                



Cache


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




























                



Tuned Model


Python
                  






  
  














  





  
    
  
  











  









  




  




  # With Gemini 2 we're launching a new SDK. See the following doc for details.
# https://ai.google.dev/gemini-api/docs/migrateREADME.md




























                



JSON Mode


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types
from typing_extensions import TypedDict

class Recipe(TypedDict):
    recipe_name: str
    ingredients: list[str]

client = genai.Client()
result = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="List a few popular cookie recipes.",
    config=types.GenerateContentConfig(
        response_mime_type="application/json", response_schema=list[Recipe]
    ),
)
print(result)controlled_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "List a few popular cookie recipes.",
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recipeName: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
        },
        required: ["recipeName", "ingredients"],
      },
    },
  },
});
console.log(response.text);controlled_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"), 
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

schema := &genai.Schema{
	Type: genai.TypeArray,
	Items: &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"recipe_name": {Type: genai.TypeString},
			"ingredients": {
				Type:  genai.TypeArray,
				Items: &genai.Schema{Type: genai.TypeString},
			},
		},
		Required: []string{"recipe_name"},
	},
}

config := &genai.GenerateContentConfig{
	ResponseMIMEType: "application/json",
	ResponseSchema:   schema,
}

response, err := client.Models.GenerateContent(
	ctx,
	"gemini-2.0-flash",
	genai.Text("List a few popular cookie recipes."),
	config,
)
if err != nil {
	log.Fatal(err)
}
printResponse(response)controlled_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
    "contents": [{
      "parts":[
        {"text": "List 5 popular cookie recipes"}
        ]
    }],
    "generationConfig": {
        "response_mime_type": "application/json",
        "response_schema": {
          "type": "ARRAY",
          "items": {
            "type": "OBJECT",
            "properties": {
              "recipe_name": {"type":"STRING"},
            }
          }
        }
    }
}' 2> /dev/null | headcontrolled_generation.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

Schema recipeSchema = Schema.builder()
        .type(Array.class.getSimpleName())
        .items(Schema.builder()
                .type(Object.class.getSimpleName())
                .properties(
                        Map.of("recipe_name", Schema.builder()
                                        .type(String.class.getSimpleName())
                                        .build(),
                                "ingredients", Schema.builder()
                                        .type(Array.class.getSimpleName())
                                        .items(Schema.builder()
                                                .type(String.class.getSimpleName())
                                                .build())
                                        .build())
                )
                .required(List.of("recipe_name", "ingredients"))
                .build())
        .build();

GenerateContentConfig config =
        GenerateContentConfig.builder()
                .responseMimeType("application/json")
                .responseSchema(recipeSchema)
                .build();

GenerateContentResponse response =
        client.models.generateContent(
                "gemini-2.0-flash",
                "List a few popular cookie recipes.",
                config);

System.out.println(response.text());ControlledGeneration.java




























                



Code execution


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-2.0-pro-exp-02-05",
    contents=(
        "Write and execute code that calculates the sum of the first 50 prime numbers. "
        "Ensure that only the executable code and its resulting output are generated."
    ),
)
# Each part may contain text, executable code, or an execution result.
for part in response.candidates[0].content.parts:
    print(part, "\n")

print("-" * 80)
# The .text accessor concatenates the parts into a markdown-formatted text.
print("\n", response.text)code_execution.py




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

response, err := client.Models.GenerateContent(
	ctx,
	"gemini-2.0-pro-exp-02-05",
	genai.Text(
		`Write and execute code that calculates the sum of the first 50 prime numbers.
		 Ensure that only the executable code and its resulting output are generated.`,
	),
	&genai.GenerateContentConfig{},
)
if err != nil {
	log.Fatal(err)
}

// Print the response.
printResponse(response)

fmt.Println("--------------------------------------------------------------------------------")
fmt.Println(response.Text())code_execution.go




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

String prompt = """
        Write and execute code that calculates the sum of the first 50 prime numbers.
        Ensure that only the executable code and its resulting output are generated.
        """;

GenerateContentResponse response =
        client.models.generateContent(
                "gemini-2.0-pro-exp-02-05",
                prompt,
                null);

for (Part part : response.candidates().get().getFirst().content().get().parts().get()) {
    System.out.println(part + "\n");
}

System.out.println("-".repeat(80));
System.out.println(response.text());CodeExecution.java




























                



Function Calling


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()

def add(a: float, b: float) -> float:
    """returns a + b."""
    return a + b

def subtract(a: float, b: float) -> float:
    """returns a - b."""
    return a - b

def multiply(a: float, b: float) -> float:
    """returns a * b."""
    return a * b

def divide(a: float, b: float) -> float:
    """returns a / b."""
    return a / b

# Create a chat session; function calling (via tools) is enabled in the config.
chat = client.chats.create(
    model="gemini-2.0-flash",
    config=types.GenerateContentConfig(tools=[add, subtract, multiply, divide]),
)
response = chat.send_message(
    message="I have 57 cats, each owns 44 mittens, how many mittens is that in total?"
)
print(response.text)function_calling.py




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}
modelName := "gemini-2.0-flash"

// Create the function declarations for arithmetic operations.
addDeclaration := createArithmeticToolDeclaration("addNumbers", "Return the result of adding two numbers.")
subtractDeclaration := createArithmeticToolDeclaration("subtractNumbers", "Return the result of subtracting the second number from the first.")
multiplyDeclaration := createArithmeticToolDeclaration("multiplyNumbers", "Return the product of two numbers.")
divideDeclaration := createArithmeticToolDeclaration("divideNumbers", "Return the quotient of dividing the first number by the second.")

// Group the function declarations as a tool.
tools := []*genai.Tool{
	{
		FunctionDeclarations: []*genai.FunctionDeclaration{
			addDeclaration,
			subtractDeclaration,
			multiplyDeclaration,
			divideDeclaration,
		},
	},
}

// Create the content prompt.
contents := []*genai.Content{
	genai.NewContentFromText(
		"I have 57 cats, each owns 44 mittens, how many mittens is that in total?", genai.RoleUser,
	),
}

// Set up the generate content configuration with function calling enabled.
config := &genai.GenerateContentConfig{
	Tools: tools,
	ToolConfig: &genai.ToolConfig{
		FunctionCallingConfig: &genai.FunctionCallingConfig{
			// The mode equivalent to FunctionCallingConfigMode.ANY in JS.
			Mode: genai.FunctionCallingConfigModeAny,
		},
	},
}

genContentResp, err := client.Models.GenerateContent(ctx, modelName, contents, config)
if err != nil {
	log.Fatal(err)
}

// Assume the response includes a list of function calls.
if len(genContentResp.FunctionCalls()) == 0 {
	log.Println("No function call returned from the AI.")
	return nil
}
functionCall := genContentResp.FunctionCalls()[0]
log.Printf("Function call: %+v\n", functionCall)

// Marshal the Args map into JSON bytes.
argsMap, err := json.Marshal(functionCall.Args)
if err != nil {
	log.Fatal(err)
}

// Unmarshal the JSON bytes into the ArithmeticArgs struct.
var args ArithmeticArgs
if err := json.Unmarshal(argsMap, &args); err != nil {
	log.Fatal(err)
}

// Map the function name to the actual arithmetic function.
var result float64
switch functionCall.Name {
	case "addNumbers":
		result = add(args.FirstParam, args.SecondParam)
	case "subtractNumbers":
		result = subtract(args.FirstParam, args.SecondParam)
	case "multiplyNumbers":
		result = multiply(args.FirstParam, args.SecondParam)
	case "divideNumbers":
		result = divide(args.FirstParam, args.SecondParam)
	default:
		return fmt.Errorf("unimplemented function: %s", functionCall.Name)
}
log.Printf("Function result: %v\n", result)

// Prepare the final result message as content.
resultContents := []*genai.Content{
	genai.NewContentFromText("The final result is " + fmt.Sprintf("%v", result), genai.RoleUser),
}

// Use GenerateContent to send the final result.
finalResponse, err := client.Models.GenerateContent(ctx, modelName, resultContents, &genai.GenerateContentConfig{})
if err != nil {
	log.Fatal(err)
}

printResponse(finalResponse)function_calling.go




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




    // Make sure to include the following import:
  // import {GoogleGenAI} from '@google/genai';
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  /**
   * The add function returns the sum of two numbers.
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  function add(a, b) {
    return a + b;
  }

  /**
   * The subtract function returns the difference (a - b).
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  function subtract(a, b) {
    return a - b;
  }

  /**
   * The multiply function returns the product of two numbers.
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  function multiply(a, b) {
    return a * b;
  }

  /**
   * The divide function returns the quotient of a divided by b.
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  function divide(a, b) {
    return a / b;
  }

  const addDeclaration = {
    name: "addNumbers",
    parameters: {
      type: "object",
      description: "Return the result of adding two numbers.",
      properties: {
        firstParam: {
          type: "number",
          description:
            "The first parameter which can be an integer or a floating point number.",
        },
        secondParam: {
          type: "number",
          description:
            "The second parameter which can be an integer or a floating point number.",
        },
      },
      required: ["firstParam", "secondParam"],
    },
  };

  const subtractDeclaration = {
    name: "subtractNumbers",
    parameters: {
      type: "object",
      description:
        "Return the result of subtracting the second number from the first.",
      properties: {
        firstParam: {
          type: "number",
          description: "The first parameter.",
        },
        secondParam: {
          type: "number",
          description: "The second parameter.",
        },
      },
      required: ["firstParam", "secondParam"],
    },
  };

  const multiplyDeclaration = {
    name: "multiplyNumbers",
    parameters: {
      type: "object",
      description: "Return the product of two numbers.",
      properties: {
        firstParam: {
          type: "number",
          description: "The first parameter.",
        },
        secondParam: {
          type: "number",
          description: "The second parameter.",
        },
      },
      required: ["firstParam", "secondParam"],
    },
  };

  const divideDeclaration = {
    name: "divideNumbers",
    parameters: {
      type: "object",
      description:
        "Return the quotient of dividing the first number by the second.",
      properties: {
        firstParam: {
          type: "number",
          description: "The first parameter.",
        },
        secondParam: {
          type: "number",
          description: "The second parameter.",
        },
      },
      required: ["firstParam", "secondParam"],
    },
  };

  // Step 1: Call generateContent with function calling enabled.
  const generateContentResponse = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents:
      "I have 57 cats, each owns 44 mittens, how many mittens is that in total?",
    config: {
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
        },
      },
      tools: [
        {
          functionDeclarations: [
            addDeclaration,
            subtractDeclaration,
            multiplyDeclaration,
            divideDeclaration,
          ],
        },
      ],
    },
  });

  // Step 2: Extract the function call.(
  // Assuming the response contains a 'functionCalls' array.
  const functionCall =
    generateContentResponse.functionCalls &&
    generateContentResponse.functionCalls[0];
  console.log(functionCall);

  // Parse the arguments.
  const args = functionCall.args;
  // Expected args format: { firstParam: number, secondParam: number }

  // Step 3: Invoke the actual function based on the function name.
  const functionMapping = {
    addNumbers: add,
    subtractNumbers: subtract,
    multiplyNumbers: multiply,
    divideNumbers: divide,
  };
  const func = functionMapping[functionCall.name];
  if (!func) {
    console.error("Unimplemented error:", functionCall.name);
    return generateContentResponse;
  }
  const resultValue = func(args.firstParam, args.secondParam);
  console.log("Function result:", resultValue);

  // Step 4: Use the chat API to send the result as the final answer.
  const chat = ai.chats.create({ model: "gemini-2.0-flash" });
  const chatResponse = await chat.sendMessage({
    message: "The final result is " + resultValue,
  });
  console.log(chatResponse.text);
  return chatResponse;
}
function_calling.js




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  
cat > tools.json << EOF
{
  "function_declarations": [
    {
      "name": "enable_lights",
      "description": "Turn on the lighting system."
    },
    {
      "name": "set_light_color",
      "description": "Set the light color. Lights must be enabled for this to work.",
      "parameters": {
        "type": "object",
        "properties": {
          "rgb_hex": {
            "type": "string",
            "description": "The light color as a 6-digit hex string, e.g. ff0000 for red."
          }
        },
        "required": [
          "rgb_hex"
        ]
      }
    },
    {
      "name": "stop_lights",
      "description": "Turn off the lighting system."
    }
  ]
} 
EOF

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d @<(echo '
  {
    "system_instruction": {
      "parts": {
        "text": "You are a helpful lighting system bot. You can turn lights on and off, and you can set the color. Do not perform any other tasks."
      }
    },
    "tools": ['$(cat tools.json)'],

    "tool_config": {
      "function_calling_config": {"mode": "auto"}
    },

    "contents": {
      "role": "user",
      "parts": {
        "text": "Turn on the lights please."
      }
    }
  }
') 2>/dev/null |sed -n '/"content"/,/"finishReason"/p'function_calling.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

FunctionDeclaration addFunction =
        FunctionDeclaration.builder()
                .name("addNumbers")
                .parameters(
                        Schema.builder()
                                .type("object")
                                .properties(Map.of(
                                        "firstParam", Schema.builder().type("number").description("First number").build(),
                                        "secondParam", Schema.builder().type("number").description("Second number").build()))
                                .required(Arrays.asList("firstParam", "secondParam"))
                                .build())
                .build();

FunctionDeclaration subtractFunction =
        FunctionDeclaration.builder()
                .name("subtractNumbers")
                .parameters(
                        Schema.builder()
                                .type("object")
                                .properties(Map.of(
                                        "firstParam", Schema.builder().type("number").description("First number").build(),
                                        "secondParam", Schema.builder().type("number").description("Second number").build()))
                                .required(Arrays.asList("firstParam", "secondParam"))
                                .build())
                .build();

FunctionDeclaration multiplyFunction =
        FunctionDeclaration.builder()
                .name("multiplyNumbers")
                .parameters(
                        Schema.builder()
                                .type("object")
                                .properties(Map.of(
                                        "firstParam", Schema.builder().type("number").description("First number").build(),
                                        "secondParam", Schema.builder().type("number").description("Second number").build()))
                                .required(Arrays.asList("firstParam", "secondParam"))
                                .build())
                .build();

FunctionDeclaration divideFunction =
        FunctionDeclaration.builder()
                .name("divideNumbers")
                .parameters(
                        Schema.builder()
                                .type("object")
                                .properties(Map.of(
                                        "firstParam", Schema.builder().type("number").description("First number").build(),
                                        "secondParam", Schema.builder().type("number").description("Second number").build()))
                                .required(Arrays.asList("firstParam", "secondParam"))
                                .build())
                .build();

GenerateContentConfig config = GenerateContentConfig.builder()
        .toolConfig(ToolConfig.builder().functionCallingConfig(
                FunctionCallingConfig.builder().mode("ANY").build()
        ).build())
        .tools(
                Collections.singletonList(
                        Tool.builder().functionDeclarations(
                                Arrays.asList(
                                        addFunction,
                                        subtractFunction,
                                        divideFunction,
                                        multiplyFunction
                                )
                        ).build()

                )
        )
        .build();

GenerateContentResponse response =
        client.models.generateContent(
                "gemini-2.0-flash",
                "I have 57 cats, each owns 44 mittens, how many mittens is that in total?",
                config);


if (response.functionCalls() == null || response.functionCalls().isEmpty()) {
    System.err.println("No function call received");
    return null;
}

var functionCall = response.functionCalls().getFirst();
String functionName = functionCall.name().get();
var arguments = functionCall.args();

Map<String, BiFunction<Double, Double, Double>> functionMapping = new HashMap<>();
functionMapping.put("addNumbers", (a, b) -> a + b);
functionMapping.put("subtractNumbers", (a, b) -> a - b);
functionMapping.put("multiplyNumbers", (a, b) -> a * b);
functionMapping.put("divideNumbers", (a, b) -> b != 0 ? a / b : Double.NaN);

BiFunction<Double, Double, Double> function = functionMapping.get(functionName);

Number firstParam = (Number) arguments.get().get("firstParam");
Number secondParam = (Number) arguments.get().get("secondParam");
Double result = function.apply(firstParam.doubleValue(), secondParam.doubleValue());

System.out.println(result);FunctionCalling.java




























                



Generation config


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="Tell me a story about a magic backpack.",
    config=types.GenerateContentConfig(
        candidate_count=1,
        stop_sequences=["x"],
        max_output_tokens=20,
        temperature=1.0,
    ),
)
print(response.text)configure_model_parameters.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Tell me a story about a magic backpack.",
  config: {
    candidateCount: 1,
    stopSequences: ["x"],
    maxOutputTokens: 20,
    temperature: 1.0,
  },
});

console.log(response.text);configure_model_parameters.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

// Create local variables for parameters.
candidateCount := int32(1)
maxOutputTokens := int32(20)
temperature := float32(1.0)

response, err := client.Models.GenerateContent(
	ctx,
	"gemini-2.0-flash",
	genai.Text("Tell me a story about a magic backpack."),
	&genai.GenerateContentConfig{
		CandidateCount:  candidateCount,
		StopSequences:   []string{"x"},
		MaxOutputTokens: maxOutputTokens,
		Temperature:     &temperature,
	},
)
if err != nil {
	log.Fatal(err)
}

printResponse(response)configure_model_parameters.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
        "contents": [{
            "parts":[
                {"text": "Explain how AI works"}
            ]
        }],
        "generationConfig": {
            "stopSequences": [
                "Title"
            ],
            "temperature": 1.0,
            "maxOutputTokens": 800,
            "topP": 0.8,
            "topK": 10
        }
    }'  2> /dev/null | grep "text"configure_model_parameters.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

GenerateContentConfig config =
        GenerateContentConfig.builder()
                .candidateCount(1)
                .stopSequences(List.of("x"))
                .maxOutputTokens(20)
                .temperature(1.0F)
                .build();

GenerateContentResponse response =
        client.models.generateContent(
                "gemini-2.0-flash",
                "Tell me a story about a magic backpack.",
                config);

System.out.println(response.text());ConfigureModelParameters.java




























                



Safety Settings


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
unsafe_prompt = (
    "I support Martians Soccer Club and I think Jupiterians Football Club sucks! "
    "Write a ironic phrase about them including expletives."
)
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=unsafe_prompt,
    config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(
                category="HARM_CATEGORY_HATE_SPEECH",
                threshold="BLOCK_MEDIUM_AND_ABOVE",
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_ONLY_HIGH"
            ),
        ]
    ),
)
try:
    print(response.text)
except Exception:
    print("No information generated by the model.")

print(response.candidates[0].safety_ratings)safety_settings.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




    // Make sure to include the following import:
  // import {GoogleGenAI} from '@google/genai';
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const unsafePrompt =
    "I support Martians Soccer Club and I think Jupiterians Football Club sucks! Write a ironic phrase about them including expletives.";

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: unsafePrompt,
    config: {
      safetySettings: [
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH",
        },
      ],
    },
  });

  try {
    console.log("Generated text:", response.text);
  } catch (error) {
    console.log("No information generated by the model.");
  }
  console.log("Safety ratings:", response.candidates[0].safetyRatings);
  return response;
}
safety_settings.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

unsafePrompt := "I support Martians Soccer Club and I think Jupiterians Football Club sucks! " +
	"Write a ironic phrase about them including expletives."

config := &genai.GenerateContentConfig{
	SafetySettings: []*genai.SafetySetting{
		{
			Category:  "HARM_CATEGORY_HATE_SPEECH",
			Threshold: "BLOCK_MEDIUM_AND_ABOVE",
		},
		{
			Category:  "HARM_CATEGORY_HARASSMENT",
			Threshold: "BLOCK_ONLY_HIGH",
		},
	},
}
contents := []*genai.Content{
	genai.NewContentFromText(unsafePrompt, genai.RoleUser),
}
response, err := client.Models.GenerateContent(ctx, "gemini-2.0-flash", contents, config)
if err != nil {
	log.Fatal(err)
}

// Print the generated text.
text := response.Text()
fmt.Println("Generated text:", text)

// Print the and safety ratings from the first candidate.
if len(response.Candidates) > 0 {
	fmt.Println("Finish reason:", response.Candidates[0].FinishReason)
	safetyRatings, err := json.MarshalIndent(response.Candidates[0].SafetyRatings, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println("Safety ratings:", string(safetyRatings))
} else {
	fmt.Println("No candidate returned.")
}safety_settings.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  echo '{
    "safetySettings": [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
    ],
    "contents": [{
        "parts":[{
            "text": "'I support Martians Soccer Club and I think Jupiterians Football Club sucks! Write a ironic phrase about them.'"}]}]}' > request.json

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d @request.json 2> /dev/nullsafety_settings.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

String unsafePrompt = """
         I support Martians Soccer Club and I think Jupiterians Football Club sucks!
         Write a ironic phrase about them including expletives.
        """;

GenerateContentConfig config =
        GenerateContentConfig.builder()
                .safetySettings(Arrays.asList(
                        SafetySetting.builder()
                                .category("HARM_CATEGORY_HATE_SPEECH")
                                .threshold("BLOCK_MEDIUM_AND_ABOVE")
                                .build(),
                        SafetySetting.builder()
                                .category("HARM_CATEGORY_HARASSMENT")
                                .threshold("BLOCK_ONLY_HIGH")
                                .build()
                )).build();

GenerateContentResponse response =
        client.models.generateContent(
                "gemini-2.0-flash",
                unsafePrompt,
                config);

try {
    System.out.println(response.text());
} catch (Exception e) {
    System.out.println("No information generated by the model");
}

System.out.println(response.candidates().get().getFirst().safetyRatings());SafetySettings.java




























                



System Instruction


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="Good morning! How are you?",
    config=types.GenerateContentConfig(
        system_instruction="You are a cat. Your name is Neko."
    ),
)
print(response.text)system_instruction.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Good morning! How are you?",
  config: {
    systemInstruction: "You are a cat. Your name is Neko.",
  },
});
console.log(response.text);system_instruction.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

// Construct the user message contents.
contents := []*genai.Content{
	genai.NewContentFromText("Good morning! How are you?", genai.RoleUser),
}

// Set the system instruction as a *genai.Content.
config := &genai.GenerateContentConfig{
	SystemInstruction: genai.NewContentFromText("You are a cat. Your name is Neko.", genai.RoleUser),
}

response, err := client.Models.GenerateContent(ctx, "gemini-2.0-flash", contents, config)
if err != nil {
	log.Fatal(err)
}
printResponse(response)system_instruction.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d '{ "system_instruction": {
    "parts":
      { "text": "You are a cat. Your name is Neko."}},
    "contents": {
      "parts": {
        "text": "Hello there"}}}'system_instruction.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

Part textPart = Part.builder().text("You are a cat. Your name is Neko.").build();

Content content = Content.builder().role("system").parts(ImmutableList.of(textPart)).build();

GenerateContentConfig config = GenerateContentConfig.builder()
        .systemInstruction(content)
        .build();

GenerateContentResponse response =
        client.models.generateContent(
                "gemini-2.0-flash",
                "Good morning! How are you?",
                config);

System.out.println(response.text());SystemInstruction.java




























                








Response body
If successful, the response body contains an instance of GenerateContentResponse.




Method: models.streamGenerateContent




EndpointPath parametersRequest body

JSON representation

Response bodyAuthorization scopesExample request

TextImageAudioVideoPDFChat






Generates a streamed response from the model given an input GenerateContentRequest.




Endpoint


                post
              

https://generativelanguage.googleapis.com/v1beta/{model=models/*}:streamGenerateContent








Path parameters




model


string



Required. The name of the Model to use for generating the completion.Format: models/{model}. It takes the form models/{model}.





Request body
The request body contains data with the following structure:



Fields






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







Example request


Text


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
response = client.models.generate_content_stream(
    model="gemini-2.0-flash", contents="Write a story about a magic backpack."
)
for chunk in response:
    print(chunk.text)
    print("_" * 80)text_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContentStream({
  model: "gemini-2.0-flash",
  contents: "Write a story about a magic backpack.",
});
let text = "";
for await (const chunk of response) {
  console.log(chunk.text);
  text += chunk.text;
}text_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}
contents := []*genai.Content{
	genai.NewContentFromText("Write a story about a magic backpack.", genai.RoleUser),
}
for response, err := range client.Models.GenerateContentStream(
	ctx,
	"gemini-2.0-flash",
	contents,
	nil,
) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print(response.Candidates[0].Content.Parts[0].Text)
}text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}" \
        -H 'Content-Type: application/json' \
        --no-buffer \
        -d '{ "contents":[{"parts":[{"text": "Write a story about a magic backpack."}]}]}'text_generation.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

ResponseStream<GenerateContentResponse> responseStream =
        client.models.generateContentStream(
                "gemini-2.0-flash",
                "Write a story about a magic backpack.",
                null);

StringBuilder response = new StringBuilder();
for (GenerateContentResponse res : responseStream) {
    System.out.print(res.text());
    response.append(res.text());
}

responseStream.close();TextGeneration.java




























                



Image


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
import PIL.Image

client = genai.Client()
organ = PIL.Image.open(media / "organ.jpg")
response = client.models.generate_content_stream(
    model="gemini-2.0-flash", contents=["Tell me about this instrument", organ]
)
for chunk in response:
    print(chunk.text)
    print("_" * 80)text_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const organ = await ai.files.upload({
  file: path.join(media, "organ.jpg"),
});

const response = await ai.models.generateContentStream({
  model: "gemini-2.0-flash",
  contents: [
    createUserContent([
      "Tell me about this instrument", 
      createPartFromUri(organ.uri, organ.mimeType)
    ]),
  ],
});
let text = "";
for await (const chunk of response) {
  console.log(chunk.text);
  text += chunk.text;
}text_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}
file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "organ.jpg"), 
	&genai.UploadFileConfig{
		MIMEType : "image/jpeg",
	},
)
if err != nil {
	log.Fatal(err)
}
parts := []*genai.Part{
	genai.NewPartFromText("Tell me about this instrument"),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}
contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}
for response, err := range client.Models.GenerateContentStream(
	ctx,
	"gemini-2.0-flash",
	contents,
	nil,
) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print(response.Candidates[0].Content.Parts[0].Text)
}text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  cat > "$TEMP_JSON" << EOF
{
  "contents": [{
    "parts":[
      {"text": "Tell me about this instrument"},
      {
        "inline_data": {
          "mime_type":"image/jpeg",
          "data": "$(cat "$TEMP_B64")"
        }
      }
    ]
  }]
}
EOF

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d "@$TEMP_JSON" 2> /dev/nulltext_generation.sh




























                

Java
                  






  
  














  





  
    
  
  











  









  




  




  Client client = new Client();

String path = media_path + "organ.jpg";
byte[] imageData = Files.readAllBytes(Paths.get(path));

Content content =
        Content.fromParts(
                Part.fromText("Tell me about this instrument."),
                Part.fromBytes(imageData, "image/jpeg"));


ResponseStream<GenerateContentResponse> responseStream =
        client.models.generateContentStream(
                "gemini-2.0-flash",
                content,
                null);

StringBuilder response = new StringBuilder();
for (GenerateContentResponse res : responseStream) {
    System.out.print(res.text());
    response.append(res.text());
}

responseStream.close();TextGeneration.java




























                



Audio


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
sample_audio = client.files.upload(file=media / "sample.mp3")
response = client.models.generate_content_stream(
    model="gemini-2.0-flash",
    contents=["Give me a summary of this audio file.", sample_audio],
)
for chunk in response:
    print(chunk.text)
    print("_" * 80)text_generation.py




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "sample.mp3"), 
	&genai.UploadFileConfig{
		MIMEType : "audio/mpeg",
	},
)
if err != nil {
	log.Fatal(err)
}

parts := []*genai.Part{
	genai.NewPartFromText("Give me a summary of this audio file."),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}

contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

for result, err := range client.Models.GenerateContentStream(
	ctx,
	"gemini-2.0-flash",
	contents,
	nil,
) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print(result.Candidates[0].Content.Parts[0].Text)
}text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  # Use File API to upload audio data to API request.
MIME_TYPE=$(file -b --mime-type "${AUDIO_PATH}")
NUM_BYTES=$(wc -c < "${AUDIO_PATH}")
DISPLAY_NAME=AUDIO

tmp_header_file=upload-header.tmp

# Initial resumable request defining metadata.
# The upload url is in the response headers dump them to a file.
curl "${BASE_URL}/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -D upload-header.tmp \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \
  -d "{'file': {'display_name': '${DISPLAY_NAME}'}}" 2> /dev/null

upload_url=$(grep -i "x-goog-upload-url: " "${tmp_header_file}" | cut -d" " -f2 | tr -d "\r")
rm "${tmp_header_file}"

# Upload the actual bytes.
curl "${upload_url}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${AUDIO_PATH}" 2> /dev/null > file_info.json

file_uri=$(jq ".file.uri" file_info.json)
echo file_uri=$file_uri

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [{
        "parts":[
          {"text": "Please describe this file."},
          {"file_data":{"mime_type": "audio/mpeg", "file_uri": '$file_uri'}}]
        }]
       }' 2> /dev/null > response.json

cat response.json
echotext_generation.sh




























                



Video


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
import time

client = genai.Client()
# Video clip (CC BY 3.0) from https://peach.blender.org/download/
myfile = client.files.upload(file=media / "Big_Buck_Bunny.mp4")
print(f"{myfile=}")

# Poll until the video file is completely processed (state becomes ACTIVE).
while not myfile.state or myfile.state.name != "ACTIVE":
    print("Processing video...")
    print("File state:", myfile.state)
    time.sleep(5)
    myfile = client.files.get(name=myfile.name)

response = client.models.generate_content_stream(
    model="gemini-2.0-flash", contents=[myfile, "Describe this video clip"]
)
for chunk in response:
    print(chunk.text)
    print("_" * 80)text_generation.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let video = await ai.files.upload({
  file: path.join(media, 'Big_Buck_Bunny.mp4'),
});

// Poll until the video file is completely processed (state becomes ACTIVE).
while (!video.state || video.state.toString() !== 'ACTIVE') {
  console.log('Processing video...');
  console.log('File state: ', video.state);
  await sleep(5000);
  video = await ai.files.get({name: video.name});
}

const response = await ai.models.generateContentStream({
  model: "gemini-2.0-flash",
  contents: [
    createUserContent([
      "Describe this video clip",
      createPartFromUri(video.uri, video.mimeType),
    ]),
  ],
});
let text = "";
for await (const chunk of response) {
  console.log(chunk.text);
  text += chunk.text;
}text_generation.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "Big_Buck_Bunny.mp4"), 
	&genai.UploadFileConfig{
		MIMEType : "video/mp4",
	},
)
if err != nil {
	log.Fatal(err)
}

// Poll until the video file is completely processed (state becomes ACTIVE).
for file.State == genai.FileStateUnspecified || file.State != genai.FileStateActive {
	fmt.Println("Processing video...")
	fmt.Println("File state:", file.State)
	time.Sleep(5 * time.Second)

	file, err = client.Files.Get(ctx, file.Name, nil)
	if err != nil {
		log.Fatal(err)
	}
}

parts := []*genai.Part{
	genai.NewPartFromText("Describe this video clip"),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}

contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

for result, err := range client.Models.GenerateContentStream(
	ctx,
	"gemini-2.0-flash",
	contents,
	nil,
) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print(result.Candidates[0].Content.Parts[0].Text)
}text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  # Use File API to upload audio data to API request.
MIME_TYPE=$(file -b --mime-type "${VIDEO_PATH}")
NUM_BYTES=$(wc -c < "${VIDEO_PATH}")
DISPLAY_NAME=VIDEO_PATH

# Initial resumable request defining metadata.
# The upload url is in the response headers dump them to a file.
curl "${BASE_URL}/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -D upload-header.tmp \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \
  -d "{'file': {'display_name': '${DISPLAY_NAME}'}}" 2> /dev/null

upload_url=$(grep -i "x-goog-upload-url: " "${tmp_header_file}" | cut -d" " -f2 | tr -d "\r")
rm "${tmp_header_file}"

# Upload the actual bytes.
curl "${upload_url}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${VIDEO_PATH}" 2> /dev/null > file_info.json

file_uri=$(jq ".file.uri" file_info.json)
echo file_uri=$file_uri

state=$(jq ".file.state" file_info.json)
echo state=$state

while [[ "($state)" = *"PROCESSING"* ]];
do
  echo "Processing video..."
  sleep 5
  # Get the file of interest to check state
  curl https://generativelanguage.googleapis.com/v1beta/files/$name > file_info.json
  state=$(jq ".file.state" file_info.json)
done

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [{
        "parts":[
          {"text": "Please describe this file."},
          {"file_data":{"mime_type": "video/mp4", "file_uri": '$file_uri'}}]
        }]
       }' 2> /dev/null > response.json

cat response.json
echotext_generation.sh




























                



PDF


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai

client = genai.Client()
sample_pdf = client.files.upload(file=media / "test.pdf")
response = client.models.generate_content_stream(
    model="gemini-2.0-flash",
    contents=["Give me a summary of this document:", sample_pdf],
)

for chunk in response:
    print(chunk.text)
    print("_" * 80)text_generation.py




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

file, err := client.Files.UploadFromPath(
	ctx, 
	filepath.Join(getMedia(), "test.pdf"), 
	&genai.UploadFileConfig{
		MIMEType : "application/pdf",
	},
)
if err != nil {
	log.Fatal(err)
}

parts := []*genai.Part{
	genai.NewPartFromText("Give me a summary of this document:"),
	genai.NewPartFromURI(file.URI, file.MIMEType),
}

contents := []*genai.Content{
	genai.NewContentFromParts(parts, genai.RoleUser),
}

for result, err := range client.Models.GenerateContentStream(
	ctx,
	"gemini-2.0-flash",
	contents,
	nil,
) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print(result.Candidates[0].Content.Parts[0].Text)
}text_generation.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  MIME_TYPE=$(file -b --mime-type "${PDF_PATH}")
NUM_BYTES=$(wc -c < "${PDF_PATH}")
DISPLAY_NAME=TEXT


echo $MIME_TYPE
tmp_header_file=upload-header.tmp

# Initial resumable request defining metadata.
# The upload url is in the response headers dump them to a file.
curl "${BASE_URL}/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -D upload-header.tmp \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \
  -d "{'file': {'display_name': '${DISPLAY_NAME}'}}" 2> /dev/null

upload_url=$(grep -i "x-goog-upload-url: " "${tmp_header_file}" | cut -d" " -f2 | tr -d "\r")
rm "${tmp_header_file}"

# Upload the actual bytes.
curl "${upload_url}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${PDF_PATH}" 2> /dev/null > file_info.json

file_uri=$(jq ".file.uri" file_info.json)
echo file_uri=$file_uri

# Now generate content using that file
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [{
        "parts":[
          {"text": "Can you add a few more lines to this poem?"},
          {"file_data":{"mime_type": "application/pdf", "file_uri": '$file_uri'}}]
        }]
       }' 2> /dev/null > response.json

cat response.json
echotext_generation.sh




























                



Chat


Python
                  






  
  














  





  
    
  
  











  









  




  




  from google import genai
from google.genai import types

client = genai.Client()
chat = client.chats.create(
    model="gemini-2.0-flash",
    history=[
        types.Content(role="user", parts=[types.Part(text="Hello")]),
        types.Content(
            role="model",
            parts=[
                types.Part(
                    text="Great to meet you. What would you like to know?"
                )
            ],
        ),
    ],
)
response = chat.send_message_stream(message="I have 2 dogs in my house.")
for chunk in response:
    print(chunk.text)
    print("_" * 80)
response = chat.send_message_stream(message="How many paws are in my house?")
for chunk in response:
    print(chunk.text)
    print("_" * 80)

print(chat.get_history())chat.py




























                

Node.js
                  






  
  














  





  
    
  
  











  









  




  




  // Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  history: [
    {
      role: "user",
      parts: [{ text: "Hello" }],
    },
    {
      role: "model",
      parts: [{ text: "Great to meet you. What would you like to know?" }],
    },
  ],
});

console.log("Streaming response for first message:");
const stream1 = await chat.sendMessageStream({
  message: "I have 2 dogs in my house.",
});
for await (const chunk of stream1) {
  console.log(chunk.text);
  console.log("_".repeat(80));
}

console.log("Streaming response for second message:");
const stream2 = await chat.sendMessageStream({
  message: "How many paws are in my house?",
});
for await (const chunk of stream2) {
  console.log(chunk.text);
  console.log("_".repeat(80));
}

console.log(chat.getHistory());chat.js




























                

Go
                  






  
  














  





  
    
  
  











  









  




  




  ctx := context.Background()
client, err := genai.NewClient(ctx, &genai.ClientConfig{
	APIKey:  os.Getenv("GEMINI_API_KEY"),
	Backend: genai.BackendGeminiAPI,
})
if err != nil {
	log.Fatal(err)
}

history := []*genai.Content{
	genai.NewContentFromText("Hello", genai.RoleUser),
	genai.NewContentFromText("Great to meet you. What would you like to know?", genai.RoleModel),
}
chat, err := client.Chats.Create(ctx, "gemini-2.0-flash", nil, history)
if err != nil {
	log.Fatal(err)
}

for chunk, err := range chat.SendMessageStream(ctx, genai.Part{Text: "I have 2 dogs in my house."}) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(chunk.Text())
	fmt.Println(strings.Repeat("_", 64))
}

for chunk, err := range chat.SendMessageStream(ctx, genai.Part{Text: "How many paws are in my house?"}) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(chunk.Text())
	fmt.Println(strings.Repeat("_", 64))
}

fmt.Println(chat.History(false))chat.go




























                

Shell
                  






  
  














  





  
    
  
  











  









  




  




  curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=$GEMINI_API_KEY \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
      "contents": [
        {"role":"user",
         "parts":[{
           "text": "Hello"}]},
        {"role": "model",
         "parts":[{
           "text": "Great to meet you. What would you like to know?"}]},
        {"role":"user",
         "parts":[{
           "text": "I have two dogs in my house. How many paws are in my house?"}]},
      ]
    }' 2> /dev/null | grep "text"chat.sh




























                








Response body
If successful, the response body contains a stream of GenerateContentResponse instances.




GenerateContentResponse




JSON representationPromptFeedback

JSON representation

BlockReasonUsageMetadata

JSON representation






Response from the model supporting multiple candidate responses.Safety ratings and content filtering are reported for both prompt in GenerateContentResponse.prompt_feedback and for each candidate in finishReason and in safetyRatings. The API:  - Returns either all requested candidates or none of them  - Returns no candidates at all only if there was something wrong with the  prompt (check promptFeedback)  - Reports feedback on each candidate in finishReason and  safetyRatings.




Fields






candidates[]


object (Candidate)



Candidate responses from the model.







promptFeedback


object (PromptFeedback)



Returns the prompt's feedback related to the content filters.







usageMetadata


object (UsageMetadata)



Output only. Metadata on the generation requests' token usage.







modelVersion


string



Output only. The model version used to generate the response.







responseId


string



Output only. responseId is used to identify each response.










JSON representation




{
  "candidates": [
    {
      object (Candidate)
    }
  ],
  "promptFeedback": {
    object (PromptFeedback)
  },
  "usageMetadata": {
    object (UsageMetadata)
  },
  "modelVersion": string,
  "responseId": string
}






PromptFeedback



A set of the feedback metadata the prompt specified in GenerateContentRequest.content.




Fields






blockReason


enum (BlockReason)



Optional. If set, the prompt was blocked and no candidates are returned. Rephrase the prompt.







safetyRatings[]


object (SafetyRating)



Ratings for safety of the prompt. There is at most one rating per category.










JSON representation




{
  "blockReason": enum (BlockReason),
  "safetyRatings": [
    {
      object (SafetyRating)
    }
  ]
}






BlockReason

Specifies the reason why the prompt was blocked.









Enums




BLOCK_REASON_UNSPECIFIED
Default value. This value is unused.


SAFETY
Prompt was blocked due to safety reasons. Inspect safetyRatings to understand which safety category blocked it.


OTHER
Prompt was blocked due to unknown reasons.


BLOCKLIST
Prompt was blocked due to the terms which are included from the terminology blocklist.


PROHIBITED_CONTENT
Prompt was blocked due to prohibited content.


IMAGE_SAFETY
Candidates blocked due to unsafe image generation content.




UsageMetadata



Metadata on the generation request's token usage.




Fields






promptTokenCount


integer



Number of tokens in the prompt. When cachedContent is set, this is still the total effective prompt size meaning this includes the number of tokens in the cached content.







cachedContentTokenCount


integer



Number of tokens in the cached part of the prompt (the cached content)







candidatesTokenCount


integer



Total number of tokens across all the generated response candidates.







toolUsePromptTokenCount


integer



Output only. Number of tokens present in tool-use prompt(s).







thoughtsTokenCount


integer



Output only. Number of tokens of thoughts for thinking models.







totalTokenCount


integer



Total token count for the generation request (prompt + response candidates).







promptTokensDetails[]


object (ModalityTokenCount)



Output only. List of modalities that were processed in the request input.







cacheTokensDetails[]


object (ModalityTokenCount)



Output only. List of modalities of the cached content in the request input.







candidatesTokensDetails[]


object (ModalityTokenCount)



Output only. List of modalities that were returned in the response.







toolUsePromptTokensDetails[]


object (ModalityTokenCount)



Output only. List of modalities that were processed for tool-use request inputs.










JSON representation




{
  "promptTokenCount": integer,
  "cachedContentTokenCount": integer,
  "candidatesTokenCount": integer,
  "toolUsePromptTokenCount": integer,
  "thoughtsTokenCount": integer,
  "totalTokenCount": integer,
  "promptTokensDetails": [
    {
      object (ModalityTokenCount)
    }
  ],
  "cacheTokensDetails": [
    {
      object (ModalityTokenCount)
    }
  ],
  "candidatesTokensDetails": [
    {
      object (ModalityTokenCount)
    }
  ],
  "toolUsePromptTokensDetails": [
    {
      object (ModalityTokenCount)
    }
  ]
}







Candidate




JSON representationFinishReasonGroundingAttribution

JSON representation

AttributionSourceId

JSON representation

GroundingPassageId

JSON representation

SemanticRetrieverChunk

JSON representation

GroundingMetadata

JSON representation

SearchEntryPoint

JSON representation

GroundingChunk

JSON representation

Web

JSON representation

RetrievedContext

JSON representation

Maps

JSON representation

PlaceAnswerSources

JSON representation

ReviewSnippet

JSON representation

GroundingSupport

JSON representation

Segment

JSON representation

RetrievalMetadata

JSON representation

LogprobsResult

JSON representation

TopCandidates

JSON representation

Candidate

JSON representation

UrlContextMetadata

JSON representation

UrlMetadata

JSON representation

UrlRetrievalStatus




A response candidate generated from the model.




Fields






content


object (Content)



Output only. Generated content returned from the model.







finishReason


enum (FinishReason)



Optional. Output only. The reason why the model stopped generating tokens.If empty, the model has not stopped generating tokens.







safetyRatings[]


object (SafetyRating)



List of ratings for the safety of a response candidate.There is at most one rating per category.







citationMetadata


object (CitationMetadata)



Output only. Citation information for model-generated candidate.This field may be populated with recitation information for any text included in the content. These are passages that are "recited" from copyrighted material in the foundational LLM's training data.







tokenCount


integer



Output only. Token count for this candidate.







groundingAttributions[]


object (GroundingAttribution)



Output only. Attribution information for sources that contributed to a grounded answer.This field is populated for GenerateAnswer calls.







groundingMetadata


object (GroundingMetadata)



Output only. Grounding metadata for the candidate.This field is populated for GenerateContent calls.







avgLogprobs


number



Output only. Average log probability score of the candidate.







logprobsResult


object (LogprobsResult)



Output only. Log-likelihood scores for the response tokens and top tokens







urlContextMetadata


object (UrlContextMetadata)



Output only. Metadata related to url context retrieval tool.







index


integer



Output only. Index of the candidate in the list of response candidates.







finishMessage


string



Optional. Output only. Details the reason why the model stopped generating tokens. This is populated only when finishReason is set.










JSON representation




{
  "content": {
    object (Content)
  },
  "finishReason": enum (FinishReason),
  "safetyRatings": [
    {
      object (SafetyRating)
    }
  ],
  "citationMetadata": {
    object (CitationMetadata)
  },
  "tokenCount": integer,
  "groundingAttributions": [
    {
      object (GroundingAttribution)
    }
  ],
  "groundingMetadata": {
    object (GroundingMetadata)
  },
  "avgLogprobs": number,
  "logprobsResult": {
    object (LogprobsResult)
  },
  "urlContextMetadata": {
    object (UrlContextMetadata)
  },
  "index": integer,
  "finishMessage": string
}






FinishReason

Defines the reason why the model stopped generating tokens.









Enums




FINISH_REASON_UNSPECIFIED
Default value. This value is unused.


STOP
Natural stop point of the model or provided stop sequence.


MAX_TOKENS
The maximum number of tokens as specified in the request was reached.


SAFETY
The response candidate content was flagged for safety reasons.


RECITATION
The response candidate content was flagged for recitation reasons.


LANGUAGE
The response candidate content was flagged for using an unsupported language.


OTHER
Unknown reason.


BLOCKLIST
Token generation stopped because the content contains forbidden terms.


PROHIBITED_CONTENT
Token generation stopped for potentially containing prohibited content.


SPII
Token generation stopped because the content potentially contains Sensitive Personally Identifiable Information (SPII).


MALFORMED_FUNCTION_CALL
The function call generated by the model is invalid.


IMAGE_SAFETY
Token generation stopped because generated images contain safety violations.


IMAGE_PROHIBITED_CONTENT
Image generation stopped because generated images has other prohibited content.


IMAGE_OTHER
Image generation stopped because of other miscellaneous issue.


NO_IMAGE
The model was expected to generate an image, but none was generated.


IMAGE_RECITATION
Image generation stopped due to recitation.


UNEXPECTED_TOOL_CALL
Model generated a tool call but no tools were enabled in the request.


TOO_MANY_TOOL_CALLS
Model called too many tools consecutively, thus the system exited execution.


MISSING_THOUGHT_SIGNATURE
Request has at least one thought signature missing.




GroundingAttribution



Attribution for a source that contributed to an answer.




Fields






sourceId


object (AttributionSourceId)



Output only. Identifier for the source contributing to this attribution.







content


object (Content)



Grounding source content that makes up this attribution.










JSON representation




{
  "sourceId": {
    object (AttributionSourceId)
  },
  "content": {
    object (Content)
  }
}






AttributionSourceId



Identifier for the source contributing to this attribution.




Fields






source


Union type



source can be only one of the following:




groundingPassage


object (GroundingPassageId)



Identifier for an inline passage.







semanticRetrieverChunk


object (SemanticRetrieverChunk)



Identifier for a Chunk fetched via Semantic Retriever.













JSON representation




{

  // source
  "groundingPassage": {
    object (GroundingPassageId)
  },
  "semanticRetrieverChunk": {
    object (SemanticRetrieverChunk)
  }
  // Union type
}






GroundingPassageId



Identifier for a part within a GroundingPassage.




Fields






passageId


string



Output only. ID of the passage matching the GenerateAnswerRequest's GroundingPassage.id.







partIndex


integer



Output only. Index of the part within the GenerateAnswerRequest's GroundingPassage.content.










JSON representation




{
  "passageId": string,
  "partIndex": integer
}






SemanticRetrieverChunk



Identifier for a Chunk retrieved via Semantic Retriever specified in the GenerateAnswerRequest using SemanticRetrieverConfig.




Fields






source


string



Output only. Name of the source matching the request's SemanticRetrieverConfig.source. Example: corpora/123 or corpora/123/documents/abc







chunk


string



Output only. Name of the Chunk containing the attributed text. Example: corpora/123/documents/abc/chunks/xyz










JSON representation




{
  "source": string,
  "chunk": string
}






GroundingMetadata



Metadata returned to client when grounding is enabled.




Fields






groundingChunks[]


object (GroundingChunk)



List of supporting references retrieved from specified grounding source.







groundingSupports[]


object (GroundingSupport)



List of grounding support.







webSearchQueries[]


string



Web search queries for the following-up web search.







searchEntryPoint


object (SearchEntryPoint)



Optional. Google search entry for the following-up web searches.







retrievalMetadata


object (RetrievalMetadata)



Metadata related to retrieval in the grounding flow.







googleMapsWidgetContextToken


string



Optional. Resource name of the Google Maps widget context token that can be used with the PlacesContextElement widget in order to render contextual data. Only populated in the case that grounding with Google Maps is enabled.










JSON representation




{
  "groundingChunks": [
    {
      object (GroundingChunk)
    }
  ],
  "groundingSupports": [
    {
      object (GroundingSupport)
    }
  ],
  "webSearchQueries": [
    string
  ],
  "searchEntryPoint": {
    object (SearchEntryPoint)
  },
  "retrievalMetadata": {
    object (RetrievalMetadata)
  },
  "googleMapsWidgetContextToken": string
}






SearchEntryPoint



Google search entry point.




Fields






renderedContent


string



Optional. Web content snippet that can be embedded in a web page or an app webview.







sdkBlob


string (bytes format)



Optional. Base64 encoded JSON representing array of <search term, search url> tuple.A base64-encoded string.










JSON representation




{
  "renderedContent": string,
  "sdkBlob": string
}






GroundingChunk



Grounding chunk.




Fields






chunk_type


Union type



Chunk type. chunk_type can be only one of the following:




web


object (Web)



Grounding chunk from the web.







retrievedContext


object (RetrievedContext)



Optional. Grounding chunk from context retrieved by the file search tool.







maps


object (Maps)



Optional. Grounding chunk from Google Maps.













JSON representation




{

  // chunk_type
  "web": {
    object (Web)
  },
  "retrievedContext": {
    object (RetrievedContext)
  },
  "maps": {
    object (Maps)
  }
  // Union type
}






Web



Chunk from the web.




Fields






uri


string



URI reference of the chunk.







title


string



Title of the chunk.










JSON representation




{
  "uri": string,
  "title": string
}






RetrievedContext



Chunk from context retrieved by the file search tool.




Fields






uri


string



Optional. URI reference of the semantic retrieval document.







title


string



Optional. Title of the document.







text


string



Optional. Text of the chunk.







fileSearchStore


string



Optional. Name of the FileSearchStore containing the document. Example: fileSearchStores/123










JSON representation




{
  "uri": string,
  "title": string,
  "text": string,
  "fileSearchStore": string
}






Maps



A grounding chunk from Google Maps. A Maps chunk corresponds to a single place.




Fields






uri


string



URI reference of the place.







title


string



Title of the place.







text


string



Text description of the place answer.







placeId


string



This ID of the place, in places/{placeId} format. A user can use this ID to look up that place.







placeAnswerSources


object (PlaceAnswerSources)



Sources that provide answers about the features of a given place in Google Maps.










JSON representation




{
  "uri": string,
  "title": string,
  "text": string,
  "placeId": string,
  "placeAnswerSources": {
    object (PlaceAnswerSources)
  }
}






PlaceAnswerSources



Collection of sources that provide answers about the features of a given place in Google Maps. Each PlaceAnswerSources message corresponds to a specific place in Google Maps. The Google Maps tool used these sources in order to answer questions about features of the place (e.g: "does Bar Foo have Wifi" or "is Foo Bar wheelchair accessible?"). Currently we only support review snippets as sources.




Fields






reviewSnippets[]


object (ReviewSnippet)



Snippets of reviews that are used to generate answers about the features of a given place in Google Maps.










JSON representation




{
  "reviewSnippets": [
    {
      object (ReviewSnippet)
    }
  ]
}






ReviewSnippet



Encapsulates a snippet of a user review that answers a question about the features of a specific place in Google Maps.




Fields






reviewId


string



The ID of the review snippet.







googleMapsUri


string



A link that corresponds to the user review on Google Maps.







title


string



Title of the review.










JSON representation




{
  "reviewId": string,
  "googleMapsUri": string,
  "title": string
}






GroundingSupport



Grounding support.




Fields






groundingChunkIndices[]


integer



A list of indices (into 'grounding_chunk') specifying the citations associated with the claim. For instance [1,3,4] means that grounding_chunk[1], grounding_chunk[3], grounding_chunk[4] are the retrieved content attributed to the claim.







confidenceScores[]


number



Confidence score of the support references. Ranges from 0 to 1. 1 is the most confident. This list must have the same size as the groundingChunkIndices.







segment


object (Segment)



Segment of the content this support belongs to.










JSON representation




{
  "groundingChunkIndices": [
    integer
  ],
  "confidenceScores": [
    number
  ],
  "segment": {
    object (Segment)
  }
}






Segment



Segment of the content.




Fields






partIndex


integer



Output only. The index of a Part object within its parent Content object.







startIndex


integer



Output only. Start index in the given Part, measured in bytes. Offset from the start of the Part, inclusive, starting at zero.







endIndex


integer



Output only. End index in the given Part, measured in bytes. Offset from the start of the Part, exclusive, starting at zero.







text


string



Output only. The text corresponding to the segment from the response.










JSON representation




{
  "partIndex": integer,
  "startIndex": integer,
  "endIndex": integer,
  "text": string
}






RetrievalMetadata



Metadata related to retrieval in the grounding flow.




Fields






googleSearchDynamicRetrievalScore


number



Optional. Score indicating how likely information from google search could help answer the prompt. The score is in the range [0, 1], where 0 is the least likely and 1 is the most likely. This score is only populated when google search grounding and dynamic retrieval is enabled. It will be compared to the threshold to determine whether to trigger google search.










JSON representation




{
  "googleSearchDynamicRetrievalScore": number
}






LogprobsResult



Logprobs Result




Fields






topCandidates[]


object (TopCandidates)



Length = total number of decoding steps.







chosenCandidates[]


object (Candidate)



Length = total number of decoding steps. The chosen candidates may or may not be in topCandidates.







logProbabilitySum


number



Sum of log probabilities for all tokens.










JSON representation




{
  "topCandidates": [
    {
      object (TopCandidates)
    }
  ],
  "chosenCandidates": [
    {
      object (Candidate)
    }
  ],
  "logProbabilitySum": number
}






TopCandidates



Candidates with top log probabilities at each decoding step.




Fields






candidates[]


object (Candidate)



Sorted by log probability in descending order.










JSON representation




{
  "candidates": [
    {
      object (Candidate)
    }
  ]
}






Candidate



Candidate for the logprobs token and score.




Fields






token


string



The candidate’s token string value.







tokenId


integer



The candidate’s token id value.







logProbability


number



The candidate's log probability.










JSON representation




{
  "token": string,
  "tokenId": integer,
  "logProbability": number
}






UrlContextMetadata



Metadata related to url context retrieval tool.




Fields






urlMetadata[]


object (UrlMetadata)



List of url context.










JSON representation




{
  "urlMetadata": [
    {
      object (UrlMetadata)
    }
  ]
}






UrlMetadata



Context of the a single url retrieval.




Fields






retrievedUrl


string



Retrieved url by the tool.







urlRetrievalStatus


enum (UrlRetrievalStatus)



Status of the url retrieval.










JSON representation




{
  "retrievedUrl": string,
  "urlRetrievalStatus": enum (UrlRetrievalStatus)
}






UrlRetrievalStatus

Status of the url retrieval.









Enums




URL_RETRIEVAL_STATUS_UNSPECIFIED
Default value. This value is unused.


URL_RETRIEVAL_STATUS_SUCCESS
Url retrieval is successful.


URL_RETRIEVAL_STATUS_ERROR
Url retrieval is failed due to error.


URL_RETRIEVAL_STATUS_PAYWALL
Url retrieval is failed because the content is behind paywall.


URL_RETRIEVAL_STATUS_UNSAFE
Url retrieval is failed because the content is unsafe.





CitationMetadata




JSON representationCitationSource

JSON representation






A collection of source attributions for a piece of content.




Fields






citationSources[]


object (CitationSource)



Citations to sources for a specific response.










JSON representation




{
  "citationSources": [
    {
      object (CitationSource)
    }
  ]
}






CitationSource



A citation to a source for a portion of a specific response.




Fields






startIndex


integer



Optional. Start of segment of the response that is attributed to this source.Index indicates the start of the segment, measured in bytes.







endIndex


integer



Optional. End of the attributed segment, exclusive.







uri


string



Optional. URI that is attributed as a source for a portion of the text.







license


string



Optional. License for the GitHub project that is attributed as a source for segment.License info is required for code citations.










JSON representation




{
  "startIndex": integer,
  "endIndex": integer,
  "uri": string,
  "license": string
}







GenerationConfig




JSON representationModalitySpeechConfig

JSON representation

VoiceConfig

JSON representation

PrebuiltVoiceConfig

JSON representation

MultiSpeakerVoiceConfig

JSON representation

SpeakerVoiceConfig

JSON representation

ThinkingConfig

JSON representation

ThinkingLevelImageConfig

JSON representation

MediaResolution




Configuration options for model generation and outputs. Not all parameters are configurable for every model.




Fields






stopSequences[]


string



Optional. The set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a stop_sequence. The stop sequence will not be included as part of the response.







responseMimeType


string



Optional. MIME type of the generated candidate text. Supported MIME types are: text/plain: (default) Text output. application/json: JSON response in the response candidates. text/x.enum: ENUM as a string response in the response candidates. Refer to the docs for a list of all supported text MIME types.







responseSchema


object (Schema)



Optional. Output schema of the generated candidate text. Schemas must be a subset of the OpenAPI schema and can be objects, primitives or arrays.If set, a compatible responseMimeType must also be set. Compatible MIME types: application/json: Schema for JSON response. Refer to the JSON text generation guide for more details.







_responseJsonSchema


value (Value format)



Optional. Output schema of the generated response. This is an alternative to responseSchema that accepts JSON Schema.If set, responseSchema must be omitted, but responseMimeType is required.While the full JSON Schema may be sent, not all features are supported. Specifically, only the following properties are supported:

$id
$defs
$ref
$anchor
type
format
title
description
enum (for strings and numbers)
items
prefixItems
minItems
maxItems
minimum
maximum
anyOf
oneOf (interpreted the same as anyOf)
properties
additionalProperties
required
The non-standard propertyOrdering property may also be set.Cyclic references are unrolled to a limited degree and, as such, may only be used within non-required properties. (Nullable properties are not sufficient.) If $ref is set on a sub-schema, no other properties, except for than those starting as a $, may be set.







responseJsonSchema


value (Value format)



Optional. An internal detail. Use responseJsonSchema rather than this field.







responseModalities[]


enum (Modality)



Optional. The requested modalities of the response. Represents the set of modalities that the model can return, and should be expected in the response. This is an exact match to the modalities of the response.A model may have multiple combinations of supported modalities. If the requested modalities do not match any of the supported combinations, an error will be returned.An empty list is equivalent to requesting only text.







candidateCount


integer



Optional. Number of generated responses to return. If unset, this will default to 1. Please note that this doesn't work for previous generation models (Gemini 1.0 family)







maxOutputTokens


integer



Optional. The maximum number of tokens to include in a response candidate.Note: The default value varies by model, see the Model.output_token_limit attribute of the Model returned from the getModel function.







temperature


number



Optional. Controls the randomness of the output.Note: The default value varies by model, see the Model.temperature attribute of the Model returned from the getModel function.Values can range from [0.0, 2.0].







topP


number



Optional. The maximum cumulative probability of tokens to consider when sampling.The model uses combined Top-k and Top-p (nucleus) sampling.Tokens are sorted based on their assigned probabilities so that only the most likely tokens are considered. Top-k sampling directly limits the maximum number of tokens to consider, while Nucleus sampling limits the number of tokens based on the cumulative probability.Note: The default value varies by Model and is specified by theModel.top_p attribute returned from the getModel function. An empty topK attribute indicates that the model doesn't apply top-k sampling and doesn't allow setting topK on requests.







topK


integer



Optional. The maximum number of tokens to consider when sampling.Gemini models use Top-p (nucleus) sampling or a combination of Top-k and nucleus sampling. Top-k sampling considers the set of topK most probable tokens. Models running with nucleus sampling don't allow topK setting.Note: The default value varies by Model and is specified by theModel.top_p attribute returned from the getModel function. An empty topK attribute indicates that the model doesn't apply top-k sampling and doesn't allow setting topK on requests.







seed


integer



Optional. Seed used in decoding. If not set, the request uses a randomly generated seed.







presencePenalty


number



Optional. Presence penalty applied to the next token's logprobs if the token has already been seen in the response.This penalty is binary on/off and not dependant on the number of times the token is used (after the first). Use frequencyPenalty for a penalty that increases with each use.A positive penalty will discourage the use of tokens that have already been used in the response, increasing the vocabulary.A negative penalty will encourage the use of tokens that have already been used in the response, decreasing the vocabulary.







frequencyPenalty


number



Optional. Frequency penalty applied to the next token's logprobs, multiplied by the number of times each token has been seen in the respponse so far.A positive penalty will discourage the use of tokens that have already been used, proportional to the number of times the token has been used: The more a token is used, the more difficult it is for the model to use that token again increasing the vocabulary of responses.Caution: A negative penalty will encourage the model to reuse tokens proportional to the number of times the token has been used. Small negative values will reduce the vocabulary of a response. Larger negative values will cause the model to start repeating a common token until it hits the maxOutputTokens limit.







responseLogprobs


boolean



Optional. If true, export the logprobs results in response.







logprobs


integer



Optional. Only valid if responseLogprobs=True. This sets the number of top logprobs to return at each decoding step in the Candidate.logprobs_result. The number must be in the range of [0, 20].







enableEnhancedCivicAnswers


boolean



Optional. Enables enhanced civic answers. It may not be available for all models.







speechConfig


object (SpeechConfig)



Optional. The speech generation config.







thinkingConfig


object (ThinkingConfig)



Optional. Config for thinking features. An error will be returned if this field is set for models that don't support thinking.







imageConfig


object (ImageConfig)



Optional. Config for image generation. An error will be returned if this field is set for models that don't support these config options.







mediaResolution


enum (MediaResolution)



Optional. If specified, the media resolution specified will be used.










JSON representation




{
  "stopSequences": [
    string
  ],
  "responseMimeType": string,
  "responseSchema": {
    object (Schema)
  },
  "_responseJsonSchema": value,
  "responseJsonSchema": value,
  "responseModalities": [
    enum (Modality)
  ],
  "candidateCount": integer,
  "maxOutputTokens": integer,
  "temperature": number,
  "topP": number,
  "topK": integer,
  "seed": integer,
  "presencePenalty": number,
  "frequencyPenalty": number,
  "responseLogprobs": boolean,
  "logprobs": integer,
  "enableEnhancedCivicAnswers": boolean,
  "speechConfig": {
    object (SpeechConfig)
  },
  "thinkingConfig": {
    object (ThinkingConfig)
  },
  "imageConfig": {
    object (ImageConfig)
  },
  "mediaResolution": enum (MediaResolution)
}






Modality

Supported modalities of the response.









Enums




MODALITY_UNSPECIFIED
Default value.


TEXT
Indicates the model should return text.


IMAGE
Indicates the model should return images.


AUDIO
Indicates the model should return audio.




SpeechConfig



The speech generation config.




Fields






voiceConfig


object (VoiceConfig)



The configuration in case of single-voice output.







multiSpeakerVoiceConfig


object (MultiSpeakerVoiceConfig)



Optional. The configuration for the multi-speaker setup. It is mutually exclusive with the voiceConfig field.







languageCode


string



Optional. Language code (in BCP 47 format, e.g. "en-US") for speech synthesis.Valid values are: de-DE, en-AU, en-GB, en-IN, en-US, es-US, fr-FR, hi-IN, pt-BR, ar-XA, es-ES, fr-CA, id-ID, it-IT, ja-JP, tr-TR, vi-VN, bn-IN, gu-IN, kn-IN, ml-IN, mr-IN, ta-IN, te-IN, nl-NL, ko-KR, cmn-CN, pl-PL, ru-RU, and th-TH.










JSON representation




{
  "voiceConfig": {
    object (VoiceConfig)
  },
  "multiSpeakerVoiceConfig": {
    object (MultiSpeakerVoiceConfig)
  },
  "languageCode": string
}






VoiceConfig



The configuration for the voice to use.




Fields






voice_config


Union type



The configuration for the speaker to use. voice_config can be only one of the following:




prebuiltVoiceConfig


object (PrebuiltVoiceConfig)



The configuration for the prebuilt voice to use.













JSON representation




{

  // voice_config
  "prebuiltVoiceConfig": {
    object (PrebuiltVoiceConfig)
  }
  // Union type
}






PrebuiltVoiceConfig



The configuration for the prebuilt speaker to use.




Fields






voiceName


string



The name of the preset voice to use.










JSON representation




{
  "voiceName": string
}






MultiSpeakerVoiceConfig



The configuration for the multi-speaker setup.




Fields






speakerVoiceConfigs[]


object (SpeakerVoiceConfig)



Required. All the enabled speaker voices.










JSON representation




{
  "speakerVoiceConfigs": [
    {
      object (SpeakerVoiceConfig)
    }
  ]
}






SpeakerVoiceConfig



The configuration for a single speaker in a multi speaker setup.




Fields






speaker


string



Required. The name of the speaker to use. Should be the same as in the prompt.







voiceConfig


object (VoiceConfig)



Required. The configuration for the voice to use.










JSON representation




{
  "speaker": string,
  "voiceConfig": {
    object (VoiceConfig)
  }
}






ThinkingConfig



Config for thinking features.




Fields






includeThoughts


boolean



Indicates whether to include thoughts in the response. If true, thoughts are returned only when available.







thinkingBudget


integer



The number of thoughts tokens that the model should generate.







thinkingLevel


enum (ThinkingLevel)



Optional. The level of thoughts tokens that the model should generate.










JSON representation




{
  "includeThoughts": boolean,
  "thinkingBudget": integer,
  "thinkingLevel": enum (ThinkingLevel)
}






ThinkingLevel

Allow user to specify how much to think using enum instead of integer budget.









Enums




THINKING_LEVEL_UNSPECIFIED
Default value.


LOW
Low thinking level.


HIGH
High thinking level.




ImageConfig



Config for image generation features.




Fields






aspectRatio


string



Optional. The aspect ratio of the image to generate. Supported aspect ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9.If not specified, the model will choose a default aspect ratio based on any reference images provided.










JSON representation




{
  "aspectRatio": string
}






MediaResolution

Media resolution for the input media.









Enums




MEDIA_RESOLUTION_UNSPECIFIED
Media resolution has not been set.


MEDIA_RESOLUTION_LOW
Media resolution set to low (64 tokens).


MEDIA_RESOLUTION_MEDIUM
Media resolution set to medium (256 tokens).


MEDIA_RESOLUTION_HIGH
Media resolution set to high (zoomed reframing with 256 tokens).





HarmCategory




The category of a rating.These categories cover various kinds of harms that developers may wish to adjust.









Enums




HARM_CATEGORY_UNSPECIFIED
Category is unspecified.


HARM_CATEGORY_DEROGATORY
PaLM - Negative or harmful comments targeting identity and/or protected attribute.


HARM_CATEGORY_TOXICITY
PaLM - Content that is rude, disrespectful, or profane.


HARM_CATEGORY_VIOLENCE
PaLM - Describes scenarios depicting violence against an individual or group, or general descriptions of gore.


HARM_CATEGORY_SEXUAL
PaLM - Contains references to sexual acts or other lewd content.


HARM_CATEGORY_MEDICAL
PaLM - Promotes unchecked medical advice.


HARM_CATEGORY_DANGEROUS
PaLM - Dangerous content that promotes, facilitates, or encourages harmful acts.


HARM_CATEGORY_HARASSMENT
Gemini - Harassment content.


HARM_CATEGORY_HATE_SPEECH
Gemini - Hate speech and content.


HARM_CATEGORY_SEXUALLY_EXPLICIT
Gemini - Sexually explicit content.


HARM_CATEGORY_DANGEROUS_CONTENT
Gemini - Dangerous content.


HARM_CATEGORY_CIVIC_INTEGRITY
Gemini - Content that may be used to harm civic integrity. DEPRECATED: use enableEnhancedCivicAnswers instead.This item is deprecated!





ModalityTokenCount




JSON representationModality




Represents token counting info for a single modality.




Fields






modality


enum (Modality)



The modality associated with this token count.







tokenCount


integer



Number of tokens.










JSON representation




{
  "modality": enum (Modality),
  "tokenCount": integer
}






Modality

Content Part modality









Enums




MODALITY_UNSPECIFIED
Unspecified modality.


TEXT
Plain text.


IMAGE
Image.


VIDEO
Video.


AUDIO
Audio.


DOCUMENT
Document, e.g. PDF.





SafetyRating




JSON representationHarmProbability




Safety rating for a piece of content.The safety rating contains the category of harm and the harm probability level in that category for a piece of content. Content is classified for safety across a number of harm categories and the probability of the harm classification is included here.




Fields






category


enum (HarmCategory)



Required. The category for this rating.







probability


enum (HarmProbability)



Required. The probability of harm for this content.







blocked


boolean



Was this content blocked because of this rating?










JSON representation




{
  "category": enum (HarmCategory),
  "probability": enum (HarmProbability),
  "blocked": boolean
}






HarmProbability

The probability that a piece of content is harmful.The classification system gives the probability of the content being unsafe. This does not indicate the severity of harm for a piece of content.









Enums




HARM_PROBABILITY_UNSPECIFIED
Probability is unspecified.


NEGLIGIBLE
Content has a negligible chance of being unsafe.


LOW
Content has a low chance of being unsafe.


MEDIUM
Content has a medium chance of being unsafe.


HIGH
Content has a high chance of being unsafe.





SafetySetting




JSON representationHarmBlockThreshold




Safety setting, affecting the safety-blocking behavior.Passing a safety setting for a category changes the allowed probability that content is blocked.




Fields






category


enum (HarmCategory)



Required. The category for this setting.







threshold


enum (HarmBlockThreshold)



Required. Controls the probability threshold at which harm is blocked.










JSON representation




{
  "category": enum (HarmCategory),
  "threshold": enum (HarmBlockThreshold)
}






HarmBlockThreshold

Block at and beyond a specified harm probability.









Enums




HARM_BLOCK_THRESHOLD_UNSPECIFIED
Threshold is unspecified.


BLOCK_LOW_AND_ABOVE
Content with NEGLIGIBLE will be allowed.


BLOCK_MEDIUM_AND_ABOVE
Content with NEGLIGIBLE and LOW will be allowed.


BLOCK_ONLY_HIGH
Content with NEGLIGIBLE, LOW, and MEDIUM will be allowed.


BLOCK_NONE
All content will be allowed.


OFF
Turn off the safety filter.






  

  
