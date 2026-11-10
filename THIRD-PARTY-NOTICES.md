# Third-party notices

`dsh-sidecar` does not vendor or fork any third-party source code. At runtime it
uses the following packages from the DeepSeek Harness installation:

| Package | License | Use |
| --- | --- | --- |
| `@deepseek-ai/cordis` | MIT | Cordis service/plugin lifecycle |
| `@deepseek-ai/dsh-llm` | MIT | Message constructors and model stream |
| `@deepseek-ai/dsh-typert-protocol` | MIT | `TypertRemoteService`, `RemoteError`, Remote marker |
| `@deepseek-ai/dsh-client-ui-primitives` | MIT | React atoms (Button, Tooltip, MarkdownText, icons) |
| `react` / `react-dom` | MIT | Browser UI |

The browser bundle keeps these as external platform modules; the host bundle
imports them from the running DSH installation. They are not redistributed in
this repository. Their own license texts ship with the corresponding packages.

DeepSeek Harness is a product of DeepSeek. This is an independent community
plugin and is not an official DeepSeek package.
