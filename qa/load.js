import http from "k6/http";
import {check} from "k6";
export const options={vus:10,duration:"20s",thresholds:{http_req_failed:["rate<0.01"],http_req_duration:["p(95)<1000"],checks:["rate>0.99"]}};
export default function(){const r=http.post(`${__ENV.BASE_URL}/api/validate`,JSON.stringify({csv:"request_id,title,department,amount\nR,요청,support,1"}),{headers:{"Content-Type":"application/json",...(__ENV.SERVICE_TOKEN?{Authorization:`Bearer ${__ENV.SERVICE_TOKEN}`}:{})}});check(r,{"HTTP 200":r=>r.status===200,"accepted row":r=>r.status===200&&r.json("accepted")===1});}
