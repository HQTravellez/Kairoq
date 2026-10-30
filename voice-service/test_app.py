# SPDX-License-Identifier: GPL-3.0-or-later
import os
import pytest
from fastapi.testclient import TestClient
import app as service

KEY = "x" * 32
@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("VOICE_SERVICE_KEY", KEY)
    class Fake:
        def speech(self, body): return b"RIFFtestWAVEaudio"
        def transcribe(self, audio): return {"text": "hello", "language": "en"}
    monkeypatch.setattr(service, "engine", Fake())
    return TestClient(service.app)

def test_auth_before_body(client):
    assert client.post('/v1/speech', json={"text": "hello"}).status_code == 401
    assert client.get('/v1/voices', headers={"Authorization": "Bearer wrong"}).status_code == 401

def test_fail_closed(client, monkeypatch):
    monkeypatch.delenv('VOICE_SERVICE_KEY')
    assert client.get('/v1/voices').status_code == 401

def test_speech_and_validation(client):
    h={"Authorization": "Bearer " + KEY}
    r=client.post('/v1/speech', json={"text":"hello"}, headers=h)
    assert r.status_code == 200 and r.headers['content-type']=='audio/wav'
    for body in [{"text":" "},{"text":"x"*2001},{"text":"hello","voice":"../../file"},{"text":"hello","speed":0},{"text":"hello","url":"https://evil"}]:
        assert client.post('/v1/speech',json=body,headers=h).status_code == 422

def test_size_and_transcription(client):
    h={"Authorization":"Bearer "+KEY}
    assert client.post('/v1/transcriptions',content=b'x',headers=h).json()['text']=='hello'
    assert client.post('/v1/transcriptions',content=b'',headers=h).status_code==422
    assert client.post('/v1/transcriptions',content=b'x'*(service.MAX_UPLOAD+1),headers=h).status_code==413

def test_readiness(client,monkeypatch):
    assert client.get('/health').status_code==200
    monkeypatch.setattr(service,'engine',None)
    assert client.get('/health').status_code==503

def test_busy(client,monkeypatch):
    class Busy:
        def locked(self): return True
    monkeypatch.setattr(service,'busy',Busy())
    assert client.post('/v1/speech',json={"text":"hello"},headers={"Authorization":"Bearer "+KEY}).status_code==429
