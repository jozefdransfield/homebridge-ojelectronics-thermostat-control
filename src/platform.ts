import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { OJElectronicsThermostatAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { Group, OJElectronics, Session, Thermostat } from 'oj-electronics-thermostat';


export class OjElectronicsThermostatControlPlugin implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  private readonly thermostatAccessories: Map<string, OJElectronicsThermostatAccessory> = new Map();

  public readonly discoveredCacheUUIDs: string[] = [];


  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      this.discoverDevices();

      setInterval(() => {
        this.discoverDevices();
      }, 30_000);
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  async discoverDevices() {

    for (const account of this.config.accounts) {
      this.log.debug('Found account ', account.username);
      const api = new OJElectronics('f219aab4-9ac0-4343-8422-b72203e2fac9', parseInt(account.customerNumber));
      const session = await api.session(account.username, account.password);

      for (const group of await session.groups()) {

        for (const thermostat of group.thermostats) {
          const uuid = this.api.hap.uuid.generate(thermostat.serialNumber);

          const existingAccessory = this.accessories.get(uuid);

          if (existingAccessory) {
            this.log.debug('Restoring existing accessory from cache:', existingAccessory.displayName);

            this.api.updatePlatformAccessories([existingAccessory]);

            this.createThermostatAccessoryIfNotExists(uuid, existingAccessory, session, group, thermostat);

          } else {
            this.log.debug('Adding new accessory:', thermostat.name);

            const accessory = new this.api.platformAccessory(thermostat.name, uuid);

            this.createThermostatAccessoryIfNotExists(uuid, accessory, session, group, thermostat);

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
          this.discoveredCacheUUIDs.push(uuid);
        }
      }
    }

    this.cleanUpDevices();
  }

  private createThermostatAccessoryIfNotExists(uuid: string, accessory: PlatformAccessory, session: Session, group: Group, thermostat: Thermostat) {
    const existing = this.thermostatAccessories.get(uuid);
    if (!existing) {
      const newAccessory = new OJElectronicsThermostatAccessory(this, accessory, group, thermostat);
      this.thermostatAccessories.set(uuid, newAccessory);
      newAccessory.update();
    } else {
      existing.group = group;
      existing.thermostat = thermostat;
      existing.update();
    }

  }

  private cleanUpDevices() {
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}