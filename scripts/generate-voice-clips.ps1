# Makes the recorded fallback clips (src/renderer/assets/voice/<language>/<id>.wav) with the
# synthetic voices of Windows. Run it again whenever a message that is spoken changes:
#   powershell -File scripts/generate-voice-clips.ps1
# The list of clips comes from the same files the app reads, and src/renderer/voice/clips.test.ts
# fails when a clip is missing or when the list here and there stop agreeing.

Add-Type -AssemblyName System.Speech
$root = Split-Path -Parent $PSScriptRoot
$renderer = Join-Path $root 'src/renderer'
$voiceDir = Join-Path $renderer 'assets/voice'

$texts = @{
  es = Get-Content (Join-Path $renderer 'i18n/es.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  en = Get-Content (Join-Path $renderer 'i18n/en.json') -Raw -Encoding UTF8 | ConvertFrom-Json
}
$cultures = @{ es = 'es-MX'; en = 'en-US' }

$clips = @()
foreach ($language in $texts.Keys) {
  foreach ($file in Get-ChildItem (Join-Path $renderer 'skills') -Filter '*.json') {
    $skill = Get-Content $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($rule in $skill.rules) {
      $clips += [pscustomobject]@{ Language = $language; Id = "$($skill.id).$($rule.id)"; Text = $rule.message.$language }
    }
  }
  foreach ($variant in 0..2) {
    $clips += [pscustomobject]@{ Language = $language; Id = "praise.$variant"; Text = $texts[$language]."training.praise.$variant" }
  }
  # Keep in step with STATUS_NOTICES in src/renderer/voice/clipList.ts.
  $notices = [ordered]@{ lost = 'training.lost'; unmeasured = 'training.unmeasured'; micFailed = 'training.micFailed' }
  foreach ($notice in $notices.Keys) {
    $clips += [pscustomobject]@{ Language = $language; Id = "status.$notice"; Text = $texts[$language].($notices[$notice]) }
  }
  $clips += [pscustomobject]@{ Language = $language; Id = 'system.sample'; Text = $texts[$language].'settings.voice.sample' }
}

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
# 16 kHz mono keeps each clip small and is plenty for speech.
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

foreach ($clip in $clips) {
  $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq $cultures[$clip.Language] } | Select-Object -First 1
  if (-not $voice) { throw "No installed voice for $($cultures[$clip.Language])" }
  $synth.SelectVoice($voice.VoiceInfo.Name)

  $dir = Join-Path $voiceDir $clip.Language
  New-Item -ItemType Directory -Force $dir | Out-Null
  $synth.SetOutputToWaveFile((Join-Path $dir "$($clip.Id).wav"), $format)
  $synth.Speak($clip.Text)
  $synth.SetOutputToNull()
}

Write-Host "Made $($clips.Count) clips in $voiceDir"
