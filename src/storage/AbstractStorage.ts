import IStorage from './IStorage'
import IStats from './IStats';
import TBlockEvent, { Apis, Action } from '../event/BlockEvent';
import FakingModes from './FakingModesEnum';
import * as base64 from '../shared/base64';
import TypeGuards from '../shared/TypeGuards';

export default abstract class AbstractSettingsStorage implements IStorage {
    protected $action:Action
    protected $notify:boolean
    protected $whitelisted:boolean
    protected $fakingMode:FakingModes
    protected $updateInterval:number

    protected abstract load():void
    protected abstract save():void

    init():this {
        this.load();
        this.updateSaltIfNeeded();
        return this;
    }

    abstract getAction():Action
    abstract getNotify():boolean
    abstract getWhitelisted():boolean
    abstract getFakingMode():FakingModes
    abstract getUpdateInterval():number

    setAction(action:Action):void {
        this.$action = action;
        this.save();
    }
    setNotify(notify:boolean):void {
        this.$notify = notify;
        this.save();
    }
    setWhitelisted(whitelisted:boolean):void {
        this.$whitelisted = whitelisted;
        this.save();
    }
    setFakingmode(fakingMode:FakingModes):void {
        this.$fakingMode = fakingMode;
        this.save();
    }
    setUpdateInterval(updateInterval:number):void {
        this.$updateInterval = updateInterval;
        this.save();
    }

    protected $salt:Int32Array
    protected $lastUpdated:number
    getSalt():Int32Array {
        if (this.$fakingMode === FakingModes.EVERY_TIME) {
            return this.getRandomSalt();
        } else {
            return this.$salt;
        }
    }
    updateSalt():void {
        this.$salt = this.getRandomSalt();
    }
    private updateSaltIfNeeded():void {
        if (!this.$salt || (
            (this.$fakingMode === FakingModes.CONSTANT || this.$fakingMode === FakingModes.PER_DOMAIN ) &&
            this.now() - this.$lastUpdated > this.$updateInterval
        )) {
            this.updateSalt();
        }
    }
    protected getRandomSalt():Int32Array {
        let buffer = new Uint8Array(new ArrayBuffer(16));
        (window.crypto || window.msCrypto).getRandomValues(buffer);
        return new Int32Array(buffer.buffer);
    }

    protected readonly STATS_PREFIX = 'stats#'
    protected readonly GLOBAL_SETTINGS_KEY = 'settings'
    protected readonly now = Date.now

    protected triggerLog:ITriggerLog
    protected stats:IStats

    protected abstract loadStat():void
    protected abstract saveStat():void

    getTriggerLog():ITriggerLog {
        if (TypeGuards.isUndef(this.triggerLog))
            this.loadStat();
        return this.triggerLog;
    }
    getStat():Readonly<IStats> {
        if (TypeGuards.isUndef(this.stats))
            this.loadStat();
        return this.stats;
    }
    appendEvent(evt:TBlockEvent, domain?:string):void {
        if (TypeGuards.isUndef(this.triggerLog))
            this.loadStat();

        const entry:ITriggerLogEntry = {
            date: this.now(),
            api: evt.api,
            type: evt.type,
            action: evt.action,
            stack: evt.stack
        };
        if (domain) { entry.domain = domain; } 
        this.triggerLog.push(entry);
        switch (evt.api) {
            case Apis.canvas:
                this.stats.canvasBlockCount++;
                break;
            case Apis.audio:
                this.stats.audioBlockCount++;
                break;
        }
        this.saveStat();
    }

    enumerateDomains():string[] {
        let keys = GM_listValues();
        return keys.filter((key) => {
            return key !== this.GLOBAL_SETTINGS_KEY &&
                key.indexOf(this.STATS_PREFIX) !== 0;
        });
    }
}
