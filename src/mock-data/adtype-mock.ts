export function buildAdtypeData(overrides = {}, attributesToRemove = []) {
    const baseAdtypeData = {
        id: Math.floor(Math.random() * 1000),
        firm_id: Math.floor(Math.random() * 1000),
        descr: "Sample Adtype",
        category: "General",
        status_code_id: Math.floor(Math.random() * 10),
        _can_delegate: true,
        _is_partial: false,
        metadata: {
            jobs: [
                { job_name: 'Sales', description: 'Default entry for a sales person' },
                { job_name: 'Writer', description: 'Default entry for a Writer person' },
                { job_name: 'Producer', description: 'Default entry for a Producer person' },
                { job_name: 'Dubber', description: 'Default entry for a Dubber person' },
                { job_name: 'Traffic', description: 'Default entry for a Traffic person' },
            ],
            tvflag: 0,
            orderid: 71,
            statuses: [
                { name: 'Attention', color: 'FFC0CB' },
                { name: 'Canceled' },
                { name: 'Revision', color: 'FF7799' },
                { name: 'Extend Dates', color: 'FFA8BE' },
                { name: 'Client Recording', color: 'CDE4B7' },
                { name: 'Deleted' },
                { name: 'Needs Announcer', color: 'F2DCBC' },
            ],
            leadhours: 0,
            digitalflag: 0,
            approvalflag: 0,
            cartruleflag: 0,
            categoryflag: 0,
            streamingflag: 1,
            terrestrialflag: 1,
            restrictedFirmRoles: '',
            contractrequiredflag: 0,
            digitalurlrequiredflag: 0,
            copy_based_fields: ['stations'],
        },
        _jobs: [],
    };

    // Apply overrides
    const adtypeData = { ...baseAdtypeData, ...overrides };

    // Remove specified attributes
    attributesToRemove.forEach(attr => {
        const keys = (attr as string).split('.');
        let obj: any = adtypeData;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) return;
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
    });

    return adtypeData;
}

export const adtypeValid = buildAdtypeData();
