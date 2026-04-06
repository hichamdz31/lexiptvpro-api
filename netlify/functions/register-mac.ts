import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { mac, deviceType, model, appVersion } = await req.json()
    
    const cleanMac = mac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase()
    if (cleanMac.length !== 12) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid MAC' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const formattedMac = cleanMac.match(/.{1,2}/g)!.join(':')

    const { data: existing } = await supabase
      .from('mac_devices')
      .select('*')
      .eq('mac_address', formattedMac)
      .eq('is_deleted', 0)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('mac_devices')
        .update({
          last_open: new Date().toISOString(),
          open_count: (existing.open_count || 0) + 1,
        })
        .eq('mac_address', formattedMac)

      return new Response(
        JSON.stringify({ success: true, action: 'updated' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      const today = new Date()
      const trialEnd = new Date(today)
      trialEnd.setDate(trialEnd.getDate() + 15)

      await supabase.from('mac_devices').insert({
        mac_address: formattedMac,
        device_type: deviceType || 'unknown',
        ip_address: '0.0.0.0',
        app_version: appVersion,
        device_model: model,
        status: 'trial',
        trial_start_date: today.toISOString().split('T')[0],
        trial_end_date: trialEnd.toISOString().split('T')[0],
        expiration_date: trialEnd.toISOString().split('T')[0],
        subscription_type: 'trial',
        open_count: 1,
        activated: 0,
        is_deleted: 0
      })

      return new Response(
        JSON.stringify({ success: true, action: 'created' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
