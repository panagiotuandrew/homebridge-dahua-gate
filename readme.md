> This repository is currently under active development, please check back soon for updates.

</p>
<span align="center">

# Dahua Gate
</span>

</span>

<p align="center">
  <a href="https://github.com/panagiotuandrew/homebridge-dahua-gate/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="MIT License"></a>
</p>

This is a [Homebridge](https://homebridge.io) plugin for controlling electronic gates connected to Dahua intercom systems.

For documentation, check [below](https://github.com/panagiotuandrew/homebridge-dahua-gate/blob/main/readme.md#setup).

> [!IMPORTANT]
> Apple treats locks and garage doors as security devices, meaning that manual confirmation is required when using automations or Siri. To bypass this restriction, you can use a virtual switch plugin like [Homebridge Dummy](https://github.com/mpatfield/homebridge-dummy) to trigger the accessory indirectly.

## Requirements
 - Homebridge supported versions: 1.8.0 or later, and 2.0.0-beta.0 or later
 - Node.js supported versions: 20, 22, and 24

## Installing in Homebridge

   1. Open Homebridge and navigate to the plugins tab
   2. Search for "homebridge-dahua-gate" and download the latest version
   3. Restart Homebridge

  <details>
  <summary><b>Installing manually?</b></summary>

  > - Navigate to the terminal tab
  > - Run `npm install -g homebridge-dahua-gate`

  </details>

## Setup

> [!TIP]
> Before getting started, reserve a static IP address on your router for your main Dahua VTO unit

When setting up Dahua Gate you'll be asked for the following device details:

  - `IP Address`, commonly found on router web portals
  - `Username`, used to login into your VTO unit
  - `Password`, used to login into your VTO unit

## Tested Devices

| Device | Tested by |
| --- | --- |
| VTO2000A | [@panagiotuandrew](https://github.com/panagiotuandrew) |

If you're using a device not listed above, let me know by reporting it [here](https://github.com/panagiotuandrew/homebridge-dahua-gate/issues/new?template=report-working-device.yml).
