"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spotJobsValid = void 0;
exports.buildSpotJobsData = buildSpotJobsData;
function buildSpotJobsData(overrides = {}, attributesToRemove = []) {
    const baseSpotJobsData = {
        id: Math.floor(Math.random() * 1000),
        firm_id: Math.floor(Math.random() * 1000),
        module_ability_id: Math.floor(Math.random() * 1000),
        delegator_ability_id: Math.floor(Math.random() * 1000),
        job_name: 'Producer',
        job_descr: 'Responsible for production tasks',
        status_code_id: Math.floor(Math.random() * 100),
        adtype_id: Math.floor(Math.random() * 1000),
        _delegatorAbility: 'Delegator Ability Placeholder',
        _moduleAbility: 'Module Ability Placeholder',
        _services: {},
    };
    // Apply overrides
    const spotJobsData = { ...baseSpotJobsData, ...overrides };
    // Remove specified attributes
    attributesToRemove.forEach(attr => {
        const keys = attr.split('.');
        let obj = spotJobsData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]])
                return;
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });
    return spotJobsData;
}
exports.spotJobsValid = buildSpotJobsData();
