WebRTC Softphone (Twilio Voice)

A browser-based WebRTC softphone built with the Twilio Voice JavaScript SDK. This project demonstrates real-time calling capabilities including outbound PSTN dialing, inbound call handling, call controls (mute, hold), and token-based authentication using Twilio Functions.

The application is designed as a lightweight, client-side softphone suitable for learning, prototyping, and portfolio demonstration purposes.

Prerequisites

Before running the application, ensure you have:

A Twilio account

A Twilio Voice-enabled phone number

A TwiML App configured for Voice

Twilio Functions & Assets enabled

Required Twilio Functions
/token Function     (Token file is included in Twilio Fucntion settings)

Create a Twilio Function named /token. This function is responsible for generating a short-lived Access Token used by the browser client to authenticate with Twilio Voice. It should create a VoiceGrant using your TwiML App SID and return the JWT in JSON format. The softphone automatically requests this endpoint during initialization and again when the token is about to expire.

This function enables secure client authentication without exposing credentials in the frontend.

/voice Function       (Voice file is included in Twilio Fucntion settings)

Create a Twilio Function named /voice. This function handles call routing logic for the softphone. It should inspect the To parameter and decide whether the call is:

client-to-client

outbound PSTN

inbound PSTN to the agent

The function should return TwiML that dials the appropriate destination using your configured Caller ID. This endpoint is referenced by your TwiML App and is what actually bridges calls.

Twilio Environment Variables:

In Twilio Console → Functions → Environment Variables, configure the following:

ACCOUNT_SID — Your Twilio Account SID

API_KEY — Twilio API Key (SK…)

API_SECRET — Twilio API Secret

CALLER_ID — Your Twilio phone number in E.164 format

These values are used by the serverless functions and must not be exposed in client code.

Application Configuration

When the softphone loads, open Settings and provide:

Token URL → your deployed /token function URL

Agent Identity → any client identity (for example agent_1001)

The app stores these locally and uses them to initialize the Twilio Device.

Running the Project

Deploy the Twilio Functions

Serve the web files over HTTPS (required for WebRTC)

Open the softphone in a browser

Enter your Token URL and Identity

Start making calls

Features:

WebRTC browser softphone

Outbound PSTN dialing

Inbound call handling

Mute and hold controls

Call duration timer

Automatic token refresh

Responsive dial pad UI

Portfolio Note:

This project showcases practical implementation of Twilio Voice, WebRTC client handling, and serverless token generation in a clean, modular frontend architecture.
