import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Near Native Instagram</h1>
        <p className={styles.text}>
          Store Instagram posts as Shopify metaobjects to create your own
          Instagram feed in Liquid templates.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Shopify-native storage.</strong> Store Instagram posts as
            Shopify metaobjects to create your own Instagram feed in Liquid
            templates.
          </li>
          <li>
            <strong>Seamless integration.</strong> Easily integrate Instagram
            content into your Shopify store without any complex setup.
          </li>
          <li>
            <strong>Downloadable Liquid files for Instagram feed</strong>. Get
            pre-built Liquid files to easily display your Instagram feed on your
            Shopify store.
          </li>
        </ul>
      </div>
    </div>
  );
}
