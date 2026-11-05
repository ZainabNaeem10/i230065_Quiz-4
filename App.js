import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { getAuth, onAuthStateChanged, signInWithPhoneNumber, signOut } from '@react-native-firebase/auth';

const firebaseAuth = getAuth();

const RESEND_SECONDS = 30;
const E164 = /^\+[1-9]\d{7,14}$/;

function friendlyError(e) {
  switch (e?.code) {
    case 'auth/invalid-phone-number': return 'That phone number is not valid. Use the format +923001234567.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a while and try again.';
    case 'auth/quota-exceeded': return 'Daily SMS limit reached for this project. Try again tomorrow.';
    case 'auth/invalid-verification-code': return 'Incorrect code. Check the SMS and try again.';
    case 'auth/code-expired': return 'This code has expired. Request a new one.';
    case 'auth/session-expired': return 'This code has expired. Request a new one.';
    default: return e?.message || 'Something went wrong. Try again.';
  }
}

export default function App() {
  const [step, setStep] = useState('phone'); // phone | otp | success
  const [phone, setPhone] = useState('+92');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);

  // Android can auto-read the SMS and sign in without typing the code.
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => { if (user) setStep('success'); });
    return () => { unsub(); clearInterval(timer.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_SECONDS);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    setError('');
    const p = phone.trim();
    if (!E164.test(p)) { setError('Enter the number in international format, e.g. +923001234567'); return; }
    setLoading(true);
    try {
      const result = await signInWithPhoneNumber(firebaseAuth, p, true);
      setConfirmation(result);
      setCode('');
      setStep('otp');
      startCooldown();
    } catch (e) {
      setError(friendlyError(e));
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await confirmation.confirm(code);
      setStep('success');
    } catch (e) {
      setError(friendlyError(e));
    }
    setLoading(false);
  };

  const reset = async () => {
    try { await signOut(firebaseAuth); } catch {}
    setStep('phone'); setCode(''); setError(''); setConfirmation(null);
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 'phone' && (
          <View>
            <Text style={s.title}>Verify your phone</Text>
            <Text style={s.sub}>We'll text you a 6-digit code. Include your country code.</Text>
            <TextInput
              style={s.input} value={phone} onChangeText={setPhone}
              keyboardType="phone-pad" placeholder="+923001234567" autoFocus
            />
            {!!error && <Text style={s.error}>{error}</Text>}
            <Button label="Send code" onPress={sendOtp} loading={loading} disabled={phone.length < 8} />
          </View>
        )}

        {step === 'otp' && (
          <View>
            <Text style={s.title}>Enter the code</Text>
            <Text style={s.sub}>Sent by SMS to {phone}</Text>
            <TextInput
              style={[s.input, s.code]} value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad" maxLength={6} placeholder="------" autoFocus
              textContentType="oneTimeCode"
            />
            {!!error && <Text style={s.error}>{error}</Text>}
            <Button label="Verify" onPress={verifyOtp} loading={loading} disabled={code.length < 6} />
            <Pressable onPress={sendOtp} disabled={cooldown > 0 || loading} style={s.link}>
              <Text style={[s.linkText, cooldown > 0 && { opacity: 0.4 }]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </Pressable>
            <Pressable onPress={reset} style={s.link}>
              <Text style={s.linkText}>Change number</Text>
            </Pressable>
          </View>
        )}

        {step === 'success' && (
          <View style={{ alignItems: 'center' }}>
            <View style={s.tick}><Text style={s.tickText}>✓</Text></View>
            <Text style={s.title}>Phone verified</Text>
            <Text style={s.sub}>{phone} is now confirmed.</Text>
            <Button label="Verify another number" onPress={reset} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Button({ label, onPress, loading, disabled }) {
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} style={[s.btn, off && { opacity: 0.5 }]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F5F9' },
  wrap: { flex: 1, justifyContent: 'center', padding: 28 },
  title: { fontSize: 28, fontWeight: '700', color: '#14213D', marginBottom: 8 },
  sub: { fontSize: 15, color: '#55607A', marginBottom: 24, lineHeight: 21 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#D5DAE5',
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: '#14213D', marginBottom: 12,
  },
  code: { fontSize: 28, letterSpacing: 10, textAlign: 'center' },
  error: { color: '#B3261E', marginBottom: 12, fontSize: 14 },
  btn: { backgroundColor: '#1D4ED8', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: 16 },
  linkText: { color: '#1D4ED8', fontSize: 15 },
  tick: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#1F9D55', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  tickText: { color: '#fff', fontSize: 44 },
});