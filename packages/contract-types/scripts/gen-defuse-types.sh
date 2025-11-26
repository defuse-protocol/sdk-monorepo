#!/bin/bash -e

existing_json="./artifacts/defuse_contract_abi.json"
type_output="./src/index.ts"

# shellcheck disable=SC2016
jq_filter='
# Extract JSON Schema
.body.root_schema

# Get rid of unnecessary "type"
| del(.type)

# Set reasonable title
| .title = "NEAR Intents Contract ABI"

# Problem: WebAuthn definition includes "properties" and "onOf" together.
#          Tools cannot resolve such ambiguity. So we separate them into
#          two different definitions.
| .definitions.MultiPayload.oneOf |= (
      map(
        if ((.properties.standard.enum // []) | contains(["webauthn"])) then
          . as $webauthn |
          $webauthn.anyOf | map(
            {
              type: "object",
              description: .description,
              required: ($webauthn.required + .required),
              properties: ($webauthn.properties + .properties)
            }
          )
        else
          [.]
        end
      ) | flatten
    )
'

# Ensure the output directory exists
mkdir -p "$(dirname "$type_output")"

# Step 1: Check if the JSON file exists; if not, download and extract it in memory
if [ ! -f "$existing_json" ]; then
  echo "JSON file not found. Downloading and processing artifact in memory..."

  # Download and unzip the artifact, then apply jq filter in memory
  schema=$(curl -L "https://github.com/defuse-protocol/defuse-contracts/actions/runs/11357099231/artifacts/2061097870" \
    | unzip -p - "defuse_contract_abi.json" \
    | jq "$jq_filter")
else
  echo "JSON file found. Processing existing file..."

  # Apply jq filter to the existing file
  schema=$(jq "$jq_filter" "$existing_json" | node "lib/fix-contract-schema.js")
fi

# Step 2: Pass the modified JSON directly to json-schema-to-typescript
echo "$schema" | npm_config_registry="https://registry.npmjs.org" npx json-schema-to-typescript -o "$type_output" --unreachableDefinitions
# Prettify the output
pnpm biome format "$type_output" --write

echo "Types generated successfully in "$type_output""
