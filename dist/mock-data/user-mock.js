"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userValid = void 0;
exports.buildUserData = buildUserData;
function buildUserData(overrides = {}, attributesToRemove = []) {
    const baseUserData = {
        firm_id: Math.floor(Math.random() * 10000),
        promo_status_code_id: Math.floor(Math.random() * 100),
        ppo_status_code_id: Math.floor(Math.random() * 100),
        api_status_code_id: Math.floor(Math.random() * 100),
        trade_status_code_id: Math.floor(Math.random() * 100),
        events_status_code_id: Math.floor(Math.random() * 100),
        agency_status_code_id: Math.floor(Math.random() * 100),
        username: "testuser" + Math.floor(Math.random() * 1000),
        email_address: "user" + Math.floor(Math.random() * 1000) + "@example.com",
        first_name: "FirstName",
        last_name: "LastName",
        _text: "Full Name",
        job_title: "Job Title",
        password: `test_${Math.random().toString(36).slice(2)}`,
        products: {
            vc_status: null,
            legacy_status: null,
            promo_status: null,
            trade_status: null,
            vep_status: null,
        },
        vclient_status_code_id: Math.floor(Math.random() * 100),
        metadata: {
            additionalInfo: "Extra metadata",
            requireDoubleClickInLineEditingflag: false,
            preferences: {
                language: "en",
                timezone: "PST",
            },
            po_listview_page_size: 25,
        },
        _assignablePools: [1, 2, 3],
        _assignedPools: [4, 5],
        _preApprove: false,
        _approved: true,
        _services: null,
        _personData: null,
        _history: [],
        _abilities: [],
        _myModules: {},
        _myStations: [],
        _myStationDropdownData: [],
        _myTasks: [],
        _talentName: "Talent",
        _firmStations: [],
        _firmName: "Firm Name",
        _myStationGroups: [],
        _myMMStationGroups: [],
        _myMMStations: [],
        _myMMMarkets: [],
        _myMMFormats: [],
        _mmStationMap: new Map(),
        _mmMarketMap: new Map(),
        _mmFormatMap: new Map(),
        _token: "token123",
        _identityId: "identityId123",
        _profileInfo: {
            imageUrl: "imageUrl123",
            imageAlt: "imageAlt123",
            username: "testuser",
        },
        _metadataInitializers: [],
        _userWorkload: [],
        _addedAbilities: [],
        _firmIdChanged: false,
        _firmUpdate: {},
        _voiceProfile: {},
        _myFirm: null,
        _myFirms: [],
        _restrictedStations: [],
        _relationshipAbilitiesByFirm: {},
        _mapped_restricted_abilities: {
            approvalflag: 323,
            delegatorflag: 313,
        },
        _mapped_abilities: {
            produceflag: 320,
            dubflag: 321,
        },
    };
    // Apply overrides
    const userData = { ...baseUserData, ...overrides };
    // Remove specified attributes
    attributesToRemove.forEach(attr => {
        const keys = attr.split('.');
        let obj = userData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]])
                return; // Break early if path doesn't exist
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });
    return userData;
}
exports.userValid = buildUserData();
