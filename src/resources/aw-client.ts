import axios, { AxiosInstance } from 'axios';

export interface Event {
    timestamp: string;
    duration: number;
    data: { [k: string]: any };
}

declare var module: any;
const isNode = (typeof module !== 'undefined' && module.exports);
     

class AWClient {
    public clientname: string;
    public testing: boolean;
    public req: AxiosInstance;

    constructor(clientname: string, testing: boolean, baseurl: string | undefined = undefined) {
        this.clientname = clientname;
        this.testing = testing;
        if (baseurl === undefined){
            let port = !testing ? 5600 : 5666;
            baseurl = 'http://127.0.0.1:'+port;
        }

        this.req = axios.create({
          baseURL: baseurl+'/api',
          timeout: 10000,
          headers: (!isNode) ? {} : {'User-Agent': 'aw-client-js/0.1'}
        });

        // Make 304 not an error (necessary for create bucket requests)
        this.req.interceptors.response.use(
            response => {
                return response;
            }, err => {
                if (err && err.response && err.response.status === 304) {
                    return err.data;
                } else {
                    return Promise.reject(err);
                }
            }
        );
    }

    info() {
        return this.req.get('/0/info');
    }

    createBucket(bucket_id: string, type: string, hostname: string) {
        return this.req.post('/0/buckets/'+bucket_id, {
            client: this.clientname,
            type: type,
            hostname: hostname,
        });
    }

    deleteBucket(bucket_id: string) {
        return this.req.delete('/0/buckets/'+bucket_id+"?force=1");
    }

    getBuckets() {
        return this.req.get("/0/buckets/");
    }

    getBucketInfo(bucket_id: string) {
        return this.req.get("/0/buckets/" + bucket_id);
    }

    // TODO: check what type params should be
    getEvents(bucket_id: string, params: any) {
        return this.req.get("/0/buckets/" + bucket_id + "/events", {params: params});
    }

    // TODO: check what types starttime and endtime are
    getEventCount(bucket_id: string, starttime: any, endtime: any) {
        let params = {
            starttime: starttime,
            endtime: endtime,
        };
        return this.req.get("/0/buckets/" + bucket_id + "/events/count", {params: params});
    }

    // TODO: Check what type event is
    insertEvent(bucket_id: string, event: Event) {
        return this.insertEvents(bucket_id, [event]);
    }

    // TODO: Check what type events is
    insertEvents(bucket_id: string, events: Array<Event>) {
        return this.req.post('/0/buckets/' + bucket_id + "/events", events);
    }

    // TODO: Check what types pulsetime and data are
    heartbeat(bucket_id: string, pulsetime: any, data: Event) {
        return this.req.post('/0/buckets/' + bucket_id + "/heartbeat?pulsetime=" + pulsetime, data);
    }

    // TODO: Check what type timeperiods and query are
    query(timeperiods: any, query: any) {
        let data = { timeperiods: timeperiods, query: query };
        return this.req.post('/0/query/', data);
    }
}

export { AWClient };