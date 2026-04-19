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
          await this.digestRequest(url);
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
        await this.digestRequest(url);
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
}
