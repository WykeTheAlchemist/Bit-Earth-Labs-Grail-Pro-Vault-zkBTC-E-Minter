import paho.mqtt.client as mqtt
import json

client = mqtt.Client()
client.connect("mqtt.bit-earth.org", 1883)

def on_connect(client, userdata, flags, rc):
    print("Connected to MQTT broker")
    # Subscribe to device commands
    client.subscribe("bit-earth/device/+/command")
    # Publish sensor data
    client.publish("bit-earth/device/+/data", json.dumps(sensor_data))

client.on_connect = on_connect
client.loop_forever()
