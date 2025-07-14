"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spotPresets = void 0;
exports.buildSpotData = buildSpotData;
const rxjs_1 = require("rxjs");
function buildSpotData(overrides = {}, attributesToRemove = []) {
    const baseData = {
        id: Math.floor(Math.random() * 1000000),
        prod_order_id: Math.floor(Math.random() * 100000),
        firm_id: Math.floor(Math.random() * 10000),
        adtype_id: Math.floor(Math.random() * 1000),
        client_id: Math.floor(Math.random() * 1000000),
        spot_title: "Default Title",
        status: "Active",
        metadata: {
            script: "<p>Now I'm going to start typing and I'm still typing but the words haven't shown up just yetkljsdfjsodkfjjkosdf</p>",
            draft_id: 357517,
            soldflag: 1,
            stations: [109488, 109489],
            draftflag: 0,
            created_by: 600920,
            created_on: "2021/01/30 02:41:06",
            createdate: "2021/01/30 02:41:06",
            spot_users: [
                {
                    job_id: "Sales",
                    user_id: 603590,
                    nonAutoJobAssigned: false,
                },
            ],
            spot_length: 59,
            submitted_on: "2021/01/30 02:41:06",
            spot_stations: [
                {
                    stationid: 109488,
                    contractno: "1231232",
                    group_name: "Group A",
                    station_id: 109488,
                },
                {
                    stationid: 109489,
                    contractno: "1231232",
                    group_name: "Group A",
                    station_id: 109489,
                },
            ],
            approval_ability: 0,
            approval_label: '',
            approval_waiting: 0,
            approvespotflag: true,
            rotationpercent: 100,
            uniqueiscigenerated: true,
            spot_files: [
                { file_id: 1, status_code_id: 3, file_name: "valid_file_1.mp4" },
                { file_id: 2, status_code_id: 2, file_name: "invalid_file_2.mp4" },
                { file_id: 3, status_code_id: 3, file_name: "valid_file_3.mp4" },
            ],
            versions: [
                {
                    label: 'Author: Demo Prod Director - 2025-02-21 09:25:21',
                    value: 'First version'
                },
                {
                    label: 'Author: Demo Prod Director - 2025-02-22 09:25:21',
                    value: 'Second version'
                }
            ]
        },
        toggle$: new rxjs_1.BehaviorSubject(true),
    };
    // Apply overrides
    const spotData = { ...baseData, ...overrides };
    // Remove specified attributes
    attributesToRemove.forEach(attr => {
        const keys = attr.split('.');
        let obj = spotData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]])
                return; // Break early if path doesn't exist
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });
    return spotData;
}
// Spot data presets
exports.spotPresets = {
    valid: buildSpotData()
};
