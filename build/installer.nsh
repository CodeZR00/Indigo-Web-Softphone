!macro customInstall
  ; Register application capabilities
  WriteRegStr HKCU "Software\RegisteredApplications" "INDIGO Softphone" "Software\Clients\StartMenuInternet\INDIGO Softphone\Capabilities"

  WriteRegStr HKCU "Software\Clients\StartMenuInternet\INDIGO Softphone\Capabilities" "ApplicationName" "INDIGO Softphone"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\INDIGO Softphone\Capabilities" "ApplicationDescription" "INDIGO Softphone Dialer"

  WriteRegStr HKCU "Software\Clients\StartMenuInternet\INDIGO Softphone\Capabilities\URLAssociations" "tel" "INDIGO Softphone.tel"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\INDIGO Softphone\Capabilities\URLAssociations" "sip" "INDIGO Softphone.sip"

  ;  ProgId registration (missing piece)
  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.tel" "" "URL:INDIGO Softphone Tel Protocol"
  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.tel" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.tel\DefaultIcon" "" "$INSTDIR\INDIGO Softphone.exe"
  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.tel\shell\open\command" "" '"$INSTDIR\INDIGO Softphone.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.sip" "" "URL:INDIGO Softphone SIP Protocol"
  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.sip" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.sip\DefaultIcon" "" "$INSTDIR\INDIGO Softphone.exe"
  WriteRegStr HKCU "Software\Classes\INDIGO Softphone.sip\shell\open\command" "" '"$INSTDIR\INDIGO Softphone.exe" "%1"'
!macroend