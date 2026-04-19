"use strict";

const axios = require("axios");
const crypto = require("crypto");

module.exports = (homebridge) => {
  homebridge.registerAccessory(
    "homebridge-dahua-gate",
    "Dahua Gate",
    DahuaGateRelease
  );
};

class DahuaGateRelease {
  constructor(log, config, api) {
    this.Service         = api.hap.Service;
    this.Characteristic  = api.hap.Characteristic;
    this.log             = log;
    this.name            = config.name;
    this.ip              = config.ip;
    this.username        = config.username;
    this.password        = config.password;
    this.pollInterval    = config.pollInterval    ?? 60000;
    this.verboseLogging  = config.verboseLogging  ?? false;
    this.fallbackRetries = config.fallbackRetries ?? 1;
    this.fallbackDelay   = config.fallbackDelay   ?? 5000;
    this.autoLockTime    = config.autoLockTime    ?? 0;
    this.autoLockUnit    = config.autoLockUnit    ?? "seconds";
    this._faultState     = this.Characteristic.StatusFault.NO_FAULT;

    this.axios = axios;

    this.service = new this.Service.LockMechanism(this.name);

    this.service
      .getCharacteristic(this.Characteristic.StatusFault)
      .onGet(async () => this._faultState);

    this.service
      .getCharacteristic(this.Characteristic.LockCurrentState)
      .onGet(this.handleGetCurrentState.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.LockTargetState)
      .onGet(this.handleGetTargetState.bind(this))
      .onSet(this.handleSetTargetState.bind(this));

    this.startPolling();
  }

  getServices() {
    return [this.service];
  }

  async handleGetCurrentState() {
    return this.Characteristic.LockCurrentState.SECURED;
  }

  async handleGetTargetState() {
    return this.Characteristic.LockTargetState.SECURED;
  }

  async handleSetTargetState(value) {
    if (value === this.Characteristic.LockTargetState.UNSECURED) {
      this.log.info(`Sending openDoor command to ${this.ip}`);
      const url = `http://${this.ip}/cgi-bin/accessControl.cgi?action=openDoor&channel=1&UserID=0`;
      let attempts = 0;

      const doRequest = async () => {
        try {
          const resp = await this.digestRequest(url);
          if (this.verboseLogging) {
            this.log.debug(`HTTP ${resp.status}`);
          }

          this.service.updateCharacteristic(
            this.Characteristic.LockCurrentState,
            this.Characteristic.LockCurrentState.UNSECURED
          );

          this.scheduleAutoLock();
        } catch (err) {
          attempts++;
          this.log.error(`openDoor failed (try ${attempts}): ${err.message}`);
          if (attempts <= this.fallbackRetries) {
            setTimeout(doRequest, this.fallbackDelay);
          }
        }
      };

      await doRequest();
    }
  }

  scheduleAutoLock() {
    if (this.autoLockTime > 0) {
      const unitMs = {
        seconds: 1000,
        hours:   3600000,
        days:    86400000
      };
      const delay = this.autoLockTime * (unitMs[this.autoLockUnit] || 1000);

      if (this.verboseLogging) {
        this.log.debug(
          `Auto-lock scheduled in ${this.autoLockTime} ${this.autoLockUnit} (${delay}ms)`
        );
      }

      setTimeout(() => {
        this.service.updateCharacteristic(
          this.Characteristic.LockCurrentState,
          this.Characteristic.LockCurrentState.SECURED
        );
        this.service.updateCharacteristic(
          this.Characteristic.LockTargetState,
          this.Characteristic.LockTargetState.SECURED
        );
        if (this.verboseLogging) {
          this.log.debug("Auto-lock executed");
        }
      }, delay);
    }
  }

  startPolling() {
    setInterval(async () => {
      try {
        await this.digestRequest(`http://${this.ip}/`);
        if (this.verboseLogging) {
          this.log.debug("Intercom reachable");
        }
        this._faultState = this.Characteristic.StatusFault.NO_FAULT;
      } catch (err) {
        this.log.error(`Poll failed: ${err.message}`);
        this._faultState = this.Characteristic.StatusFault.GENERAL_FAULT;
      }

      this.service.updateCharacteristic(
        this.Characteristic.StatusFault,
        this._faultState
      );
    }, this.pollInterval);
  }

    async digestRequest(url) {
    // codeql[js/weak-cryptographic-algorithm]
    // codeql[js/insufficient-password-hash]
    const md5 = str => crypto.createHash("md5").update(str).digest("hex");
    // First request — no auth, expect 401 with WWW-Authenticate header
    let resp;
    try {
    resp = await this.axios.get(url);
    return resp;
    } catch (err) {
    if (!err.response || err.response.status !== 401) throw err;
    resp = err.response;
      }

    // Parse WWW-Authenticate header
    const header = resp.headers["www-authenticate"] || "";
    const get    = key => (header.match(new RegExp(`${key}="([^"]*)"`))||[])[1];
    const realm  = get("realm");
    const nonce  = get("nonce");
    const qop    = get("qop");

    // Compute digest
    const ha1    = md5(`${this.username}:${realm}:${this.password}`);
    const ha2    = md5(`GET:${new URL(url).pathname}${new URL(url).search}`);
    const nc     = "00000001";
    const cnonce = crypto.randomBytes(8).toString("hex");
    const res    = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

    // Build Authorization header
    const auth = `Digest username="${this.username}", realm="${realm}", ` +
    `nonce="${nonce}", uri="${new URL(url).pathname}${new URL(url).search}", ` +
    (qop ? `qop=${qop}, nc=${nc}, cnonce="${cnonce}", ` : "") +
    `response="${res}"`;

    return this.axios.get(url, { headers: { Authorization: auth } });
  }
}
