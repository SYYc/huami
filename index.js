const axios = require('axios')
const qs = require('qs')

// 小米运动账号
const huaMiAccount = [
  {phone: '13800138000', pwd: '********', steps: 55555},
]

const axiosInstance = axios.create({
  baseURL: '',
  timeout: 20000
})
axiosInstance.interceptors.request.use(
  config => {
    return config
  },
  error => {
    console.log(error)
    return Promise.reject(error)
  }
)
axiosInstance.interceptors.response.use(
  response => {
    return response
  },
  error => {
    const { status } = error.response
    if(status >= 300 && status <= 399){
      return error.response
    }
    console.log(error)
    return Promise.reject(error)
  }
)

class Huami {
  headers = {
    'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
    'User-Agent':'MiFit/4.6.0 (iPhone; iOS 14.0.1; Scale/2.00)'
  }
  account = huaMiAccount
  constructor(){}

  async getAccess(account = false, pwd = false){
    if(!account || !pwd) return false
    const url = `https://api-user.huami.com/registrations/+86${account}/tokens`
    const temp = {
      'client_id': 'HuaMi',
      'password': pwd,
      'redirect_uri': 'https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html',
      'token': 'access'
    }
    const data = qs.stringify(temp)
    const response = await axiosInstance({url, method: 'post', data, headers: this.headers, maxRedirects: 0})
    const location = response.headers['location'] || false
    const access = /(?<=access=).*?(?=&)/.exec(location)
    if(!access || !access[0]) return false
    return access[0]
  }

  async getUserInfo(login_token = false){
    if(!login_token) return false
    const url = 'https://account-cn2.huami.com/v1/client/re_login'
    const temp = {
        'app_name': 'com.xiaomi.hm.health',
        'device_id': '0',
        'login_token': login_token,
        'device_id_type': 'imei',
    }
    const data = qs.stringify(temp)
    const response = await axiosInstance({url, method: 'post',data, headers: {'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8"}})
    return response.data.token_info
  }

  async login(account = false, pwd = false){
    if(!account || !pwd) return false
    const access = await this.getAccess(account, pwd)
    if(!access) return access
    const url = `https://account.huami.com/v2/client/login`
    const temp = {
      'app_name': 'com.xiaomi.hm.health',
      'app_version': '4.6.0',
      'code': access,
      'country_code': 'CN',
      'device_id': '2C8B4939-0CCD-4E94-8CBA-CB8EA6E613A1',
      'device_model': 'phone',
      'grant_type': 'access_token',
      'third_name': 'huami_phone',
    }
    const data = qs.stringify(temp)
    const response = await axiosInstance({url, method: 'post', data, headers: this.headers, maxRedirects: 0})
    const token = response.data
    const user = this.getUserInfo(token.token_info.login_token)
    return user
  }

  async bootstrap(){
    this.account.forEach( async (item, index) => {
      const token = await this.login(item.phone, item.pwd)
      if(!token) {
        console.log(`账号: ${item.phone} 登录失败，请检查账号信息!`)
        return true
      }
      const time = (new Date).getTime()
      const millisecond = Math.ceil( time / 1e3)
      const summary = {
        slp: {
          st: millisecond,
          ed: millisecond
        },
        stp: {
          ttl: item.steps
        }
      }
      const data_json = [{
        date: `${(new Date).getFullYear()}-${(new Date).getMonth() + 1}-${(new Date).getDate()}`,
        data: [],
        summary: JSON.stringify(summary)
      }]
      const temp = {
        userid: token.user_id,
        last_sync_data_time: time - (8 * 60), 
        data_json: JSON.stringify(data_json),
        device_type: 0,
        last_deviceid: 'C12355FFFE11D9CA'
      }
      const data = qs.stringify(temp)
      const url = `https://api-mifit-cn2.huami.com/v1/data/band_data.json?&t=${millisecond}`

      const response = await axiosInstance({
        url, 
        method: 'post',
        headers: { apptoken: token.app_token, 'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 13_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/7.0.12(0x17000c2d) NetType/WIFI Language/zh_CN`},
        data: decodeURIComponent(data)
      })
      const result = response.data
      if(result.code == 1) {
        console.log(`账号 ${item.phone } 步数刷新成功， 当前 ${item.steps} 步.`)
      }else{
        console.log(`账号 ${item.phone } 步数刷新失败 `)
      }
    })
  }
}

exports.main_handler = (event, context) => {
  (new Huami).bootstrap()
}
