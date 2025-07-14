interface Metadata {
    region: string;
    format: string;
}

export interface StationData {
    id: number;
    firm_id: number;
    callletters: string;
    official_callletters: string;
    band: string;
    station_band: number;
    station_type: string;
    ppo_status_code_id: number;
    promo_status_code_id: number;
    market_id: number;
    back_color: string;
    fore_color: string;
    metadata: Metadata;
    firm_name: string;
    market_name: string;
    firmName: string;
    officialCallletters: string;
    trade_status_code_id: number;
    services: null;
    _addCartId: boolean;
    _convertBoolean: string;
    _firmGroup: string;
}

export function buildStationData(overrides: Partial<StationData> = {}, attributesToRemove: string[] = []): StationData {
    const baseStationData: StationData = {
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
    const stationData: StationData = { ...baseStationData, ...overrides };
    attributesToRemove.forEach(attr => {
        const keys: string[] = attr.split('.');
        let obj: any = stationData;
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

export const stationValid = buildStationData();
