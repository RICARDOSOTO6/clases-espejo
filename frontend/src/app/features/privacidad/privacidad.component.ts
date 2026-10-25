import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FECHA_AVISO_PRIVACIDAD, VERSION_AVISO_PRIVACIDAD } from '../../core/constants/privacidad';

/**
 * Aviso de privacidad y términos.
 *
 * Es una página pública: la tiene que poder leer quien todavía no tiene cuenta.
 * El texto es la versión que se acepta al registrarse o al activar una
 * invitación; si cambia, hay que subir la versión en `common/privacidad.ts`.
 */
@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="legal-page">
      <article class="legal-card">
        <a class="link-button" routerLink="/login">← Volver al acceso</a>

        <h1>Aviso de privacidad y términos</h1>
        <p class="legal-meta">Versión {{ version }} · Vigente desde el {{ fecha }}</p>

        <p>
          Este documento explica qué datos personales usa <strong>Clases Conjuntas</strong>, para
          qué y cómo ejercer tus derechos. Es la versión que aceptas al crear una cuenta o al
          activar una invitación.
        </p>

        <h2>1. Responsable</h2>
        <p>
          El responsable del tratamiento es la
          <strong>Comunidad de Apoyo a Clases Espejo (CACE)</strong>, a través de la plataforma
          Clases Conjuntas. Para cualquier asunto de privacidad puedes escribir al correo
          institucional de la CACE que aparece en la propia plataforma.
        </p>

        <h2>2. Datos que se recogen</h2>
        <ul>
          <li>
            <strong>De los agentes y docentes:</strong> nombre, apellidos, tipo y número de
            documento, correo, institución, cargo, especialidad y datos de contacto de la
            institución.
          </li>
          <li>
            <strong>De los alumnos:</strong> nombre, matrícula y correo, cuando el docente los carga
            para emitir certificados. La lista la proporciona la institución; la plataforma no los
            pide directamente al alumno.
          </li>
          <li>
            <strong>De uso:</strong> sesiones, clases espejo, evidencias, evaluaciones, certificados
            y registros de acceso necesarios para que la plataforma funcione y para atender
            incidencias.
          </li>
        </ul>

        <h2>3. Para qué se usan</h2>
        <p>
          Para gestionar las clases espejo, las instituciones, las solicitudes, la agenda, las
          evidencias, los certificados y la verificación de su folio; para enviar correos operativos
          (invitaciones, confirmaciones, avisos y certificados); y para mantener la seguridad de las
          cuentas. No se usan para publicidad ni se venden a terceros.
        </p>

        <h2>4. Base legal y consentimiento</h2>
        <p>
          El tratamiento se apoya en la relación académica e institucional y en el consentimiento de
          quien se registra. Al cargar una lista de alumnos, la institución y el docente declaran
          contar con la autorización o base legal necesaria para compartir el nombre, la matrícula y
          el correo de esos alumnos con la finalidad de emitir sus certificados.
        </p>

        <h2>5. Conservación</h2>
        <p>
          Los datos se conservan mientras la cuenta o la clase espejo estén activas y, después,
          durante los plazos necesarios para acreditar la participación o atender obligaciones. Los
          certificados emitidos se conservan para que su folio se pueda verificar; si se anulan, la
          verificación lo indica y el motivo queda registrado. Una institución dada de baja queda
          inoperable y archivada, sin borrar su historial.
        </p>

        <h2>6. Derechos</h2>
        <p>
          Puedes pedir acceso, rectificación, cancelación u oposición al tratamiento de tus datos, y
          retirar tu consentimiento, escribiendo a la CACE. La institución que cargó una lista de
          alumnos es el primer canal para corregir los datos de esos alumnos. También puedes
          solicitar la baja de tu cuenta, sin perjuicio de los registros que deban conservarse.
        </p>

        <h2>7. Términos de uso</h2>
        <p>
          La cuenta es personal y no se comparte. No se permite subir contenido ilícito, datos de
          terceros sin autorización, archivos maliciosos ni usar la plataforma para suplantar a otra
          persona o institución. El uso indebido puede provocar la suspensión de la cuenta y las
          acciones que correspondan.
        </p>

        <h2>8. Cambios</h2>
        <p>
          Si este aviso cambia de forma relevante, se publicará una versión nueva con su fecha. La
          versión aceptada queda registrada en la cuenta. Si el cambio exige una nueva aceptación,
          la plataforma la pedirá antes de continuar.
        </p>

        <p class="legal-nota">
          Documento base de la plataforma. Antes de usarlo con datos reales, la CACE debe revisar el
          texto y completar el correo de contacto y los plazos de conservación que le correspondan.
        </p>

        <a class="link-button" routerLink="/login">← Volver al acceso</a>
      </article>
    </main>
  `,
  styles: [
    `
      .legal-page {
        min-height: 100vh;
        padding: 24px;
        background: var(--bg, #f4f7f6);
      }
      .legal-card {
        max-width: 760px;
        margin: 0 auto;
        padding: 32px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
        color: #1f2937;
        line-height: 1.65;
      }
      h1 {
        margin: 18px 0 8px;
        font-size: 1.8rem;
      }
      h2 {
        margin: 26px 0 8px;
        font-size: 1.1rem;
      }
      .legal-meta {
        color: #64748b;
        font-size: 0.9rem;
      }
      .legal-nota {
        margin-top: 28px;
        padding: 12px 14px;
        border-left: 3px solid #94a3b8;
        background: #f8fafc;
        color: #475569;
        font-size: 0.9rem;
      }
      ul {
        padding-left: 20px;
      }
      @media (max-width: 640px) {
        .legal-page {
          padding: 12px;
        }
        .legal-card {
          padding: 20px;
        }
      }
    `,
  ],
})
export class PrivacidadComponent {
  readonly version = VERSION_AVISO_PRIVACIDAD;
  readonly fecha = FECHA_AVISO_PRIVACIDAD;
}
