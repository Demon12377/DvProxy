# Gemini API

Source: https://ai.google.dev/gemini-api/docs

==================



  
    
    



























































Gemini API

 The developer platform to build and scale with Google's latest AI models. Start in minutes. 

Pythonfrom google import genai

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Explain how AI works in a few words",
)

print(response.text)

JavaScriptimport { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain how AI works in a few words",
  });
  console.log(response.text);
}

await main();

Gopackage main

import (
    "context"
    "fmt"
    "log"
    "google.golang.org/genai"
)

func main() {
    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)
    if err != nil {
        log.Fatal(err)
    }

    result, err := client.Models.GenerateContent(
        ctx,
        "gemini-2.5-flash",
        genai.Text("Explain how AI works in a few words"),
        nil,
    )
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(result.Text())
}

Javapackage com.example;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;

public class GenerateTextFromTextInput {
  public static void main(String[] args) {
    Client client = new Client();

    GenerateContentResponse response =
        client.models.generateContent(
            "gemini-2.5-flash",
            "Explain how AI works in a few words",
            null);

    System.out.println(response.text());
  }
}

C#using System.Threading.Tasks;
using Google.GenAI;
using Google.GenAI.Types;

public class GenerateContentSimpleText {
  public static async Task main() {
    var client = new Client();
    var response = await client.Models.GenerateContentAsync(
      model: "gemini-2.5-flash", contents: "Explain how AI works in a few words"
    );
    Console.WriteLine(response.Candidates[0].Content.Parts[0].Text);
  }
}

RESTcurl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Explain how AI works in a few words"
          }
        ]
      }
    ]
  }'



  Start building
  
    Follow our Quickstart guide to get an API key and make your first API call in minutes.
    
      For most models, you can start with our free tier, without having to set up a billing account.
    
  





  Meet the models
  
    
      
        spark
        Gemini 3 Pro
      
      
        Our most intelligent model, the best in the world for multimodal understanding, all built on state-of-the-art reasoning.
      
    
    
      
        spark
        Gemini 2.5 Pro
      
      
        Our powerful reasoning model, which excels at coding and complex reasonings tasks.
      
    
    
      
        spark
        Gemini 2.5 Flash
      
      
        Our most balanced model, with a 1 million token context window and more.
      
    
    
      
        spark
        Gemini 2.5 Flash-Lite
      
      
        Our fastest and most cost-efficient multimodal model with great performance
        for high-frequency tasks.
      
    
    
      
        video_library
        Veo 3.1
      
      
        Our state-of-the-art video generation model, with native audio.
      
    
    
      
        🍌
        Gemini 2.5 Flash Image (Nano Banana)
      
      
        State-of-the-art image generation and editing model
      
    
  
  Explore Capabilities
  
    
      
        
          imagesmode
        
      
      
        
          Native Image Generation (Nano Banana)
        
        
          Generate and edit highly contextual images natively with Gemini 2.5 Flash Image.
        
      
    
    
      
        
          article
        
      
      
        
          Long Context
        
        
          Input millions of tokens to Gemini models and derive understanding from unstructured images, videos, and documents.
        
      
    
    
      
        
          code
        
      
      
        
          Structured Outputs
        
        
          Constrain Gemini to respond with JSON, a structured data format suitable for automated processing.
        
      
    
    
      
        
          functions
        
      
      
        
          Function Calling
        
        
          Build agentic workflows by connecting Gemini to external APIs and tools.
        
      
    
    
      
        
          videocam
        
      
      
        
          Video Generation with Veo 3.1
        
        
          Create high-quality video content from text or image prompts with our state-of-the-art model.
        
      
    
    
      
        
          android_recorder
        
      
      
        
          Voice Agents with Live API
        
        
          Build real-time voice applications and agents with the Live API.
        
      
    
    
      
        
          build
        
      
      
        
          Tools
        
        
          Connect Gemini to the world through built-in tools like Google Search, URL Context, Google Maps, Code Execution and Computer Use.
        
      
    
    
      
        
          stacks
        
      
      
        
          Document Understanding
        
        
          Process up to 1000 pages of PDF files.
        
      
    
    
      
        
          cognition_2
        
      
      
        
          Thinking
        
        
          Explore how thinking capabilities improve reasoning for complex tasks and agents.
        
      
    
  
  Developer Toolkit
  
    
      
        
          
          AI Studio
        
        
          Test prompts, manage your API keys, monitor usage, and build prototypes in our web-based IDE.
        
      
      
        Open AI Studio
      
    
    
      
        
          group
          Developer Community
        
        
          Ask questions and find solutions from other developers and Google engineers.
        
      
      
        Join the community
      
    
    
      
        
          menu_book
          API Reference
        
        
          Find detailed information about the Gemini API in the official reference documentation.
        
      
      
        Access the API reference
      
    
  


  

  
