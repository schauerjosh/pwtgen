"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stationValid = void 0;
exports.buildStationData = buildStationData;
function buildStationData(overrides = {}, attributesToRemove = []) {
    const baseStationData = {
        id: Math.floor(Math.random() * 1000000),
        firm_id: Math.floor(Math.random() * 1000),
        callletters: "TEST-01",
        official_callletters: "TEST-Official",
        band: 'FM',
        station_band: Math.floor(Math.random() * 10),
        station_type: 'Radio',
        ppo_status_code_id: Math.floor(Math.random() * 10),
        promo_status_code_id: Math.floor(Math.random() * 10),
        market_id: Math.floor(Math.random() * 100),
        back_color: "#FFFFFF",
        fore_color: "#000000",
        metadata: {
            region: "North America",
            format: "Pop",
        },
        firm_name: "Test Firm",
        market_name: "Test Market",
        firmName: "Test Firm",
        officialCallletters: "TEST-Official",
        trade_status_code_id: Math.floor(Math.random() * 10),
        services: null,
        _addCartId: false,
        _convertBoolean: "true",
        _firmGroup: "Group A",
    };
    const stationData = { ...baseStationData, ...overrides };
    attributesToRemove.forEach(attr => {
        const keys = attr.split('.');
        let obj = stationData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) {
                return;
            }
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });
    return stationData;
}
exports.stationValid = buildStationData();
