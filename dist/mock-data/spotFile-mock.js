"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spotFileValid = void 0;
exports.buildSpotFileData = buildSpotFileData;
function buildSpotFileData(overrides = {}, attributesToRemove = []) {
    const baseSpotFileData = {
        id: Math.floor(Math.random() * 1000),
        firm_id: Math.floor(Math.random() * 1000),
        spot_id: Math.floor(Math.random() * 1000),
        file_desc: "Test File Description",
        file_type: "pdf",
        original_file_name: "test_file.pdf",
        status_code_id: 1,
        creation_user_id: Math.floor(Math.random() * 1000),
        creation_date: new Date(),
        s3_location: "s3://bucket/test_file.pdf",
    };
    // Apply overrides
    const spotFileData = { ...baseSpotFileData, ...overrides };
    // Remove specified attributes
    attributesToRemove.forEach(attr => {
        const keys = attr.split('.');
        let obj = spotFileData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]])
                return;
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });
    return spotFileData;
}
exports.spotFileValid = buildSpotFileData();
