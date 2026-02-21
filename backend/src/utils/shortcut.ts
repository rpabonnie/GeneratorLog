import { randomUUID } from 'crypto';

// Generates an iOS .shortcut plist file (XML property list) for toggling the generator.
// The shortcut uses a WFWorkflowImportQuestion to ask the user for their API key on import,
// so the raw key never needs to be stored or transmitted by the server.
export function generateToggleShortcut(toggleEndpoint: string, shortcutName: string): string {
  const textActionUUID = randomUUID().toUpperCase();
  const httpActionUUID = randomUUID().toUpperCase();

  // \uFFFC is the Unicode OBJECT REPLACEMENT CHARACTER used as a token placeholder
  // in WFTextTokenString attachment ranges.
  const tokenPlaceholder = '\uFFFC';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>WFWorkflowActions</key>
\t<array>
\t\t<!-- Action 0: Text holding the API key (set via import question) -->
\t\t<dict>
\t\t\t<key>WFWorkflowActionIdentifier</key>
\t\t\t<string>is.workflow.actions.gettext</string>
\t\t\t<key>WFWorkflowActionParameters</key>
\t\t\t<dict>
\t\t\t\t<key>CustomOutputName</key>
\t\t\t\t<string>API Key</string>
\t\t\t\t<key>UUID</key>
\t\t\t\t<string>${textActionUUID}</string>
\t\t\t\t<key>WFTextActionText</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>Value</key>
\t\t\t\t\t<dict>
\t\t\t\t\t\t<key>string</key>
\t\t\t\t\t\t<string></string>
\t\t\t\t\t</dict>
\t\t\t\t\t<key>WFSerializationType</key>
\t\t\t\t\t<string>WFTextTokenString</string>
\t\t\t\t</dict>
\t\t\t</dict>
\t\t</dict>
\t\t<!-- Action 1: POST request to toggle endpoint with x-api-key header -->
\t\t<dict>
\t\t\t<key>WFWorkflowActionIdentifier</key>
\t\t\t<string>is.workflow.actions.downloadurl</string>
\t\t\t<key>WFWorkflowActionParameters</key>
\t\t\t<dict>
\t\t\t\t<key>UUID</key>
\t\t\t\t<string>${httpActionUUID}</string>
\t\t\t\t<key>WFHTTPMethod</key>
\t\t\t\t<string>POST</string>
\t\t\t\t<key>WFURL</key>
\t\t\t\t<string>${toggleEndpoint}</string>
\t\t\t\t<key>WFHTTPHeaders</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>Value</key>
\t\t\t\t\t<dict>
\t\t\t\t\t\t<key>WFDictionaryFieldValueItems</key>
\t\t\t\t\t\t<array>
\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t<key>WFItemType</key>
\t\t\t\t\t\t\t\t<integer>0</integer>
\t\t\t\t\t\t\t\t<key>WFKey</key>
\t\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t\t<key>Value</key>
\t\t\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t\t\t<key>string</key>
\t\t\t\t\t\t\t\t\t\t<string>x-api-key</string>
\t\t\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t\t\t\t<key>WFSerializationType</key>
\t\t\t\t\t\t\t\t\t<string>WFTextTokenString</string>
\t\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t\t\t<key>WFValue</key>
\t\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t\t<key>Value</key>
\t\t\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t\t\t<key>attachmentsByRange</key>
\t\t\t\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t\t\t\t<key>{0, 1}</key>
\t\t\t\t\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t\t\t\t\t<key>OutputName</key>
\t\t\t\t\t\t\t\t\t\t\t\t<string>API Key</string>
\t\t\t\t\t\t\t\t\t\t\t\t<key>OutputUUID</key>
\t\t\t\t\t\t\t\t\t\t\t\t<string>${textActionUUID}</string>
\t\t\t\t\t\t\t\t\t\t\t\t<key>Type</key>
\t\t\t\t\t\t\t\t\t\t\t\t<string>ActionOutput</string>
\t\t\t\t\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t\t\t\t\t<key>string</key>
\t\t\t\t\t\t\t\t\t\t<string>${tokenPlaceholder}</string>
\t\t\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t\t\t\t<key>WFSerializationType</key>
\t\t\t\t\t\t\t\t\t<string>WFTextTokenString</string>
\t\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t</array>
\t\t\t\t\t</dict>
\t\t\t\t\t<key>WFSerializationType</key>
\t\t\t\t\t<string>WFDictionaryFieldValue</string>
\t\t\t\t</dict>
\t\t\t\t<key>WFShowHUD</key>
\t\t\t\t<true/>
\t\t\t</dict>
\t\t</dict>
\t\t<!-- Action 2: Show the API response (started/stopped status) -->
\t\t<dict>
\t\t\t<key>WFWorkflowActionIdentifier</key>
\t\t\t<string>is.workflow.actions.showresult</string>
\t\t\t<key>WFWorkflowActionParameters</key>
\t\t\t<dict>
\t\t\t\t<key>Text</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>Value</key>
\t\t\t\t\t<dict>
\t\t\t\t\t\t<key>attachmentsByRange</key>
\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t<key>{0, 1}</key>
\t\t\t\t\t\t\t<dict>
\t\t\t\t\t\t\t\t<key>OutputName</key>
\t\t\t\t\t\t\t\t<string>Get Contents of URL</string>
\t\t\t\t\t\t\t\t<key>OutputUUID</key>
\t\t\t\t\t\t\t\t<string>${httpActionUUID}</string>
\t\t\t\t\t\t\t\t<key>Type</key>
\t\t\t\t\t\t\t\t<string>ActionOutput</string>
\t\t\t\t\t\t\t</dict>
\t\t\t\t\t\t</dict>
\t\t\t\t\t\t<key>string</key>
\t\t\t\t\t\t<string>${tokenPlaceholder}</string>
\t\t\t\t\t</dict>
\t\t\t\t\t<key>WFSerializationType</key>
\t\t\t\t\t<string>WFTextTokenString</string>
\t\t\t\t</dict>
\t\t\t</dict>
\t\t</dict>
\t</array>
\t<key>WFWorkflowClientVersion</key>
\t<string>1140.41</string>
\t<key>WFWorkflowHasShortcutInputVariables</key>
\t<false/>
\t<key>WFWorkflowIcon</key>
\t<dict>
\t\t<key>WFWorkflowIconStartColor</key>
\t\t<integer>946986751</integer>
\t\t<key>WFWorkflowIconGlyphNumber</key>
\t\t<integer>59511</integer>
\t</dict>
\t<key>WFWorkflowImportQuestions</key>
\t<array>
\t\t<dict>
\t\t\t<key>ActionIndex</key>
\t\t\t<integer>0</integer>
\t\t\t<key>Category</key>
\t\t\t<string>Parameter</string>
\t\t\t<key>DefaultValue</key>
\t\t\t<string></string>
\t\t\t<key>ParameterKey</key>
\t\t\t<string>WFTextActionText</string>
\t\t\t<key>Text</key>
\t\t\t<string>Enter your Generator Log API Key (starts with gl_)</string>
\t\t</dict>
\t</array>
\t<key>WFWorkflowInputContentItemClasses</key>
\t<array/>
\t<key>WFWorkflowMinimumClientVersion</key>
\t<integer>900</integer>
\t<key>WFWorkflowMinimumClientVersionString</key>
\t<string>900</string>
\t<key>WFWorkflowName</key>
\t<string>${shortcutName}</string>
\t<key>WFWorkflowOutputContentItemClasses</key>
\t<array/>
\t<key>WFWorkflowTypes</key>
\t<array/>
</dict>
</plist>`;
}
