"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firmValid = void 0;
exports.buildFirmData = buildFirmData;
function buildFirmData(overrides = {}, attributesToRemove = []) {
    const baseFirmData = {
        firm_name: "Test Firm",
        parent_firm_id: Math.floor(Math.random() * 1000),
        timezone: "UTC",
        promo_status_code_id: Math.floor(Math.random() * 100),
        ppo_status_code: "active",
        _firmStations: [],
        _users: [],
        _lock: false,
        _services: null,
        metadata: {
            industry: "Technology",
            region: "North America",
            use_incremental_isci: false,
        },
        _uploadOperations: {},
        integrationVendorOptions: null,
    };
    // Apply overrides
    const firmData = { ...baseFirmData, ...overrides };
    // Remove specified attributes
    attributesToRemove.forEach(attr => {
        const keys = attr.split('.');
        let obj = firmData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]])
                return;
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });
    return firmData;
}
exports.firmValid = buildFirmData();
