// FirebaseConfig.cs - STUB
// The project was changed to use client-side Firebase only. This file remains as a non-functional
// placeholder to avoid runtime errors if referenced. The server-side admin helper has been removed.

using System;

namespace IPTSYSTEM.Firebase
{
    [Obsolete("FirebaseConfig is removed. Use client-side Firebase (wwwroot/js/firebase-client.js) or reintroduce admin SDK integration if server-side writes are required.")]
    public static class FirebaseConfig
    {
        public static object InitializeFirestore()
        {
            throw new NotSupportedException("Server-side Firebase is disabled. Remove calls to FirebaseConfig.InitializeFirestore() or reintroduce the admin SDK.");
        }
    }
}
