// ============================================================
//  BENCINA Y AUTOS — Fisicalización con Auto L298N + Arduino
//  Motor DC con puente H L298N
//  Pin layout (ajusta si tu cableado es distinto):
//    ENA → 5   (PWM velocidad motor A)
//    IN1 → 6   (dirección)
//    IN2 → 7   (dirección)
//    Buzzer → 9 (opcional, piezoeléctrico)
// ============================================================

// --- Pines Motor ---
const int ENA = 5;   // PWM
const int IN1 = 6;
const int IN2 = 7;

// --- Pin Buzzer (opcional) ---
const int BUZZER_PIN = 9;

// --- Estado global ---
bool motorRunning   = false;
int  motorSpeed     = 0;   // 0–255 PWM
int  buzzFreq       = 0;   // Hz
unsigned long moveEndTime = 0;

// ============================================================
void setup() {
  Serial.begin(9600);
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  stopMotor();
  Serial.println("READY");
}

// ============================================================
void loop() {
  // Leer comandos seriales
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    parseCommand(cmd);
  }

  // Detener motor cuando se cumple el tiempo
  if (motorRunning && millis() >= moveEndTime) {
    stopMotor();
    Serial.println("DONE");
  }
}

// ============================================================
//  Protocolo: MOVE,<distancia_cm>,<velocidad_pwm>,<freq_buzzer>
//  Ejemplo:   MOVE,80,200,440
//  STOP       → detiene inmediatamente
// ============================================================
void parseCommand(String cmd) {
  if (cmd.startsWith("MOVE,")) {
    // Parsear campos
    int f1 = cmd.indexOf(',');
    int f2 = cmd.indexOf(',', f1 + 1);
    int f3 = cmd.indexOf(',', f2 + 1);

    float dist_cm  = cmd.substring(f1 + 1, f2).toFloat();
    int   speed    = cmd.substring(f2 + 1, f3).toInt();
    int   freq     = cmd.substring(f3 + 1).toInt();

    // Calcular duración: calibra esta constante según tu auto
    // cm_por_segundo_a_velocidad_maxima (255 PWM) ≈ 20 cm/s
    float cm_per_sec = map(speed, 0, 255, 0, 20);  // aproximado
    if (cm_per_sec < 1) cm_per_sec = 1;
    unsigned long duracion_ms = (unsigned long)((dist_cm / cm_per_sec) * 1000.0);

    // Aplicar movimiento
    motorSpeed   = constrain(speed, 0, 255);
    buzzFreq     = freq;
    moveEndTime  = millis() + duracion_ms;
    motorRunning = true;

    driveForward(motorSpeed);
    if (buzzFreq > 0) tone(BUZZER_PIN, buzzFreq);

    Serial.print("MOVING,");
    Serial.print(dist_cm);
    Serial.print(",");
    Serial.print(motorSpeed);
    Serial.print(",");
    Serial.print(duracion_ms);
    Serial.println("ms");

  } else if (cmd == "STOP") {
    stopMotor();
    Serial.println("STOPPED");
  } else if (cmd == "PING") {
    Serial.println("PONG");
  }
}

void driveForward(int spd) {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, spd);
}

void stopMotor() {
  analogWrite(ENA, 0);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  noTone(BUZZER_PIN);
  motorRunning = false;
}