#include <Servo.h>

Servo miServo;  // Objeto para controlar el servomotor

// --- Pines Motor Adaptados ---
// El pin 9 se usa para la señal del Servo (en tu esquema original era BUZZER_PIN) [cite: 55]
const int SERVO_PIN = 9; 

// --- Estado global ---
bool motorRunning   = false;
unsigned long moveEndTime = 0;

// ============================================================
void setup() {
  Serial.begin(9600); [cite: 57]
  
  miServo.attach(SERVO_PIN);
  stopMotor(); // Posición inicial de reposo
  
  Serial.println("READY"); [cite: 58]
}

// ============================================================
void loop() {
  // Leer comandos seriales
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n'); [cite: 58]
    cmd.trim(); [cite: 59]
    parseCommand(cmd); [cite: 59]
  }

  // Detener motor cuando se cumple el tiempo calculado
  if (motorRunning && millis() >= moveEndTime) { [cite: 59]
    stopMotor(); [cite: 59]
    Serial.println("DONE"); [cite: 60]
  }
}

// ============================================================
//  Protocolo original: MOVE,<distancia_cm>,<velocidad_pwm>,<freq_buzzer> [cite: 60]
// ============================================================
void parseCommand(String cmd) {
  if (cmd.startsWith("MOVE,")) { [cite: 60]
    // Parsear campos exactamente igual al original
    int f1 = cmd.indexOf(','); [cite: 60]
    int f2 = cmd.indexOf(',', f1 + 1); [cite: 61]
    int f3 = cmd.indexOf(',', f2 + 1); [cite: 61]

    float dist_cm  = cmd.substring(f1 + 1, f2).toFloat(); [cite: 62]
    int   speed    = cmd.substring(f2 + 1, f3).toInt(); [cite: 62]
    int   freq     = cmd.substring(f3 + 1).toInt(); [cite: 63]

    // Mantenemos tu cálculo original de duración exacta [cite: 64, 65, 66]
    float cm_per_sec = map(speed, 0, 255, 0, 20); [cite: 64]
    if (cm_per_sec < 1) cm_per_sec = 1; [cite: 65]
    unsigned long duracion_ms = (unsigned long)((dist_cm / cm_per_sec) * 1000.0); [cite: 66]

    moveEndTime  = millis() + duracion_ms; [cite: 68]
    motorRunning = true; [cite: 68]

    // --- ADAPTACIÓN CON MOVIMIENTO SUAVE PARA EL SERVO ---
    // Mapeamos la velocidad a grados de giro físicos (ej: entre 60° y 120°)
    int anguloDestino = map(speed, 0, 255, 60, 120); 
    anguloDestino = constrain(anguloDestino, 0, 180);
    
    // Mueve el servo paso a paso para evitar el tirón de corriente que bloquea el USB
    int posicionActual = miServo.read();
    if (posicionActual < anguloDestino) {
      for (int pos = posicionActual; pos <= anguloDestino; pos += 2) {
        miServo.write(pos);
        delay(15); 
      }
    } else {
      for (int pos = posicionActual; pos >= anguloDestino; pos -= 2) {
        miServo.write(pos);
        delay(15);
      }
    }

    // Responder por Serial exactamente con tu formato original [cite: 68, 69]
    Serial.print("MOVING,"); [cite: 68]
    Serial.print(dist_cm); [cite: 68]
    Serial.print(","); [cite: 68]
    Serial.print(speed); [cite: 68]
    Serial.print(","); [cite: 69]
    Serial.print(duracion_ms); [cite: 69]
    Serial.println("ms"); [cite: 69]

  } else if (cmd == "STOP") { [cite: 69]
    stopMotor(); [cite: 69]
    Serial.println("STOPPED"); [cite: 69]
  } else if (cmd == "PING") { [cite: 70]
    Serial.println("PONG"); [cite: 70]
  }
}

void stopMotor() {
  miServo.write(90); // Regresa el servo a su posición neutra central (detenido)
  motorRunning = false; [cite: 71]
}