$ErrorActionPreference = 'Stop'
$projectRef = 'xujxsjdcbugghoovjnfq'

Push-Location $PSScriptRoot
try {
  function Invoke-Supabase {
    param([Parameter(Mandatory)][string[]]$Arguments)

    & npx --yes supabase@latest @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Supabase command failed: supabase $($Arguments -join ' ')"
    }
  }

  Invoke-Supabase -Arguments @('link', '--project-ref', $projectRef)
  Invoke-Supabase -Arguments @('db', 'push')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'analyze-introduction')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'analyze-document')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'generate-cv')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'journey-assistant')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'resolve-account-role', '--no-verify-jwt')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'admin-review', '--no-verify-jwt')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'request-admin-otp', '--no-verify-jwt')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'verify-admin-otp', '--no-verify-jwt')
  Invoke-Supabase -Arguments @('functions', 'deploy', 'review-application', '--no-verify-jwt')
}
finally {
  Pop-Location
}
