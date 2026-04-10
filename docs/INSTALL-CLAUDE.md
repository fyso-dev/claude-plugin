# Install on Claude

Fyso AI Plugin ships a Claude-specific adapter with Claude marketplace metadata, hooks, and agent manifests.

## Marketplace

```bash
/plugin marketplace add fyso-dev/fyso-ai-plugin
/plugin install fyso-ai@fyso-ai
```

## Team Auto-Install

Add the Claude marketplace entry and enable the plugin in your project settings:

```json
{
  "extraKnownMarketplaces": {
    "fyso-ai": {
      "source": {
        "source": "github",
        "repo": "fyso-dev/fyso-ai-plugin"
      }
    }
  },
  "enabledPlugins": {
    "fyso-ai@fyso-ai": true
  }
}
```

## Notes

- Claude gets the extra runtime layer: hooks, agent manifests, and the channel server workflow.
- Portable skills and references still come from the shared `core/` source.
