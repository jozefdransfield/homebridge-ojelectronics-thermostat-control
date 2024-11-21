import type { Characteristic, PlatformAccessory, Service } from 'homebridge';

import { OjElectronicsThermostatControlPlugin } from './platform.js';
import { Group, Temperature, Thermostat } from 'oj-electronics-thermostat';

export class OJElectronicsThermostatAccessory {
  private service: Service;
  private characteristic: typeof Characteristic;

  constructor(
    private readonly platform: OjElectronicsThermostatControlPlugin,
    private readonly accessory: PlatformAccessory,
    public group: Group,
    public thermostat: Thermostat,
  ) {

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'OJElectronics')
      .setCharacteristic(this.platform.Characteristic.Model, 'OWD5')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.thermostat.serialNumber);


    this.characteristic = platform.api.hap.Characteristic;
    this.service = this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, thermostat.name);

    this.service.getCharacteristic(this.characteristic.CurrentHeatingCoolingState);

    this.service.getCharacteristic(this.characteristic.TargetHeatingCoolingState)
      .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

    this.service.getCharacteristic(this.characteristic.CurrentTemperature);

    this.service.getCharacteristic(this.characteristic.TargetTemperature)
      .onSet(this.handleTargetTemperatureSet.bind(this));

    this.service.getCharacteristic(this.characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
      .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));

    this.service.getCharacteristic(this.characteristic.TargetHeatingCoolingState).setProps(
      {
        validValues: [
          this.characteristic.TargetHeatingCoolingState.OFF,
          this.characteristic.TargetHeatingCoolingState.HEAT,
          this.characteristic.TargetHeatingCoolingState.AUTO],
      });

    this.group = group;
    this.thermostat = thermostat;
  }

  update() {
    this.platform.log.debug('Updating Thermostat ', this.thermostat.serialNumber, this.thermostat);

    this.service.getCharacteristic(this.characteristic.CurrentTemperature)
      .updateValue(this.thermostat.floorTemperature);

    this.platform.log.debug('Fwoor is', this.thermostat.floorTemperature, this.thermostat.heating);

    if (this.thermostat.heating) {
      this.service.getCharacteristic(this.characteristic.CurrentHeatingCoolingState)
        .updateValue(this.characteristic.CurrentHeatingCoolingState.HEAT);

      this.service.getCharacteristic(this.characteristic.TargetHeatingCoolingState)
        .updateValue(this.characteristic.TargetHeatingCoolingState.HEAT);
    } else {
      this.service.getCharacteristic(this.characteristic.CurrentHeatingCoolingState)
        .updateValue(this.characteristic.CurrentHeatingCoolingState.OFF);

      this.service.getCharacteristic(this.characteristic.TargetHeatingCoolingState)
        .updateValue(this.characteristic.TargetHeatingCoolingState.AUTO);
    }

    this.service.getCharacteristic(this.characteristic.TargetTemperature)
      .updateValue(this.thermostat.manualSetPoint < 10 ? 10 : this.thermostat.manualSetPoint);
  }

  handleTargetHeatingCoolingStateSet(value) {
    this.platform.log.debug('Triggered SET TargetHeatingCoolingState:', value);
    if (value === this.characteristic.TargetHeatingCoolingState.OFF) {
      this.platform.log.info('Turning off ', this.thermostat.serialNumber);
    } else if (value === this.characteristic.TargetHeatingCoolingState.HEAT) {
      this.platform.log.info('Turning on HEAT ', this.thermostat.serialNumber);
    } else if (value === this.characteristic.TargetHeatingCoolingState.COOL) {
      this.platform.log.info('Turning on COOL ', this.thermostat.serialNumber);
    } else if (value === this.characteristic.TargetHeatingCoolingState.AUTO) {
      this.platform.log.info('Turning on AUTO ', this.thermostat.serialNumber);
      this.group.resumeSchedule().then(() => {
        this.platform.log.info('Resuming Schedule for ', this.thermostat.serialNumber);
      });
    }
  }

  handleTargetTemperatureSet(value) {
    this.platform.log.debug('Triggered SET TargetTemperature:', value);

    this.group.manualMode(Temperature.ofCelsius(value)).then(() => {
      this.platform.log.info('Setting Target Temperature to ', value, ' for ', this.thermostat.serialNumber);
    });

  }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsGet() {
    this.platform.log.debug('Triggered GET TemperatureDisplayUnits');

    // set this to a valid value for TemperatureDisplayUnits
    const currentValue = this.characteristic.TemperatureDisplayUnits.CELSIUS;

    return currentValue;
  }

  /**
   * Handle requests to set the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsSet(value) {
    this.platform.log.debug('Triggered SET TemperatureDisplayUnits:', value);
  }

}
