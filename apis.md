# Initial list of APIs included in ShadowRealm

Due to the nature of Global Objects, we expect that the Global Object of a ShadowRealm is not an exception to the rule, and the list of APIs to be available inside the ShadowRealm via the Global Object will grow organically as new use-cases are discovered. Given this fact, we are focused on definining the minimum list for the implementation to advance and get implemented in multiple browsers.

If you have a use-case for an API that was excluded, please, open a new issue.

## Rational for API Inclusion/Exclusion

The following is the criteria to include or exclude APIs from the initial list:

* Known use case? APIs must have documented use cases that justify their inclusion within the isolated context of ShadowRealm.
* Preserves confidentiality? APIs should not expose information that could compromise the confidentiality of the execution environment or the user's privacy.
* Operates within Callable Boundary? Evaluation of whether an API can operate within the integrity constraints set by the callable boundary, ensuring that the API's functionality aligns with the isolation and integrity principles of ShadowRealm.

## API Analysis

### requestAnimationFrame (rAF) API

#### Use Cases and Functionality

requestAnimationFrame is a web API that tells the browser to perform an animation and requests that the browser calls a specified function to update an animation before the next repaint. The callback function is passed a single argument, a DOMHighResTimeStamp, indicating the point in time when rAF starts to execute.

#### Isolation

Compatibility with Isolation Goals: requestAnimationFrame operates within the visual rendering context of a web page, tied closely to the browser's paint cycle. Inclusion in ShadowRealm would necessitate consideration of how this API interacts with the isolated environment, especially since ShadowRealm is designed for executing JavaScript in a separate context without direct access to the DOM or the rendering pipeline of the main document.

#### Confidentiality

Potential Information Leakage: The timestamp provided by requestAnimationFrame could, in theory, be used to infer timing information about the browser's rendering process. However, this risk is generally considered low compared to other timing mechanisms since the API is designed to sync with the display's refresh rate, not to provide high-resolution timing data. Nevertheless, careful consideration is needed to determine if this could lead to any confidentiality concerns within the context of ShadowRealm, especially if it can be used in combination with other APIs to infer more sensitive information.

#### Conclusion

Given ShadowRealm's focus on isolation and confidentiality, without direct DOM access, the necessity and usefulness of requestAnimationFrame within such an environment are not immediately apparent. Its inclusion would require clear use cases where animation or visual calculations in an isolated context are beneficial, which seems speculative at this stage.

### postMessage API

#### Isolation

postMessage is a mechanism for secure cross-origin communication between Window objects, iframes, web workers, and service workers. It allows scripts to send messages between different origins securely.
Including postMessage in ShadowRealm could potentially bridge isolated execution contexts, enabling communication between the ShadowRealm and other parts of the application or even external origins, depending on implementation.

#### Confidentiality

postMessage includes mechanisms to restrict message recipients through origin checks, potentially maintaining confidentiality by controlling who can receive messages. However, the ability to send messages outside of the ShadowRealm could introduce paths for information to flow out of the isolated environment, raising concerns about maintaining strict confidentiality.

#### Conclusion

While postMessage provides a controlled means of communication that could enrich ShadowRealm's interaction capabilities with the external environment, its inclusion requires careful consideration of the API's implications for isolation and confidentiality. It offers potential utility for applications needing to communicate between isolated JavaScript contexts and the rest of the application, but safeguards would be necessary to ensure that this communication does not compromise the isolated environment's integrity or leak sensitive information.

Given the current design goals of ShadowRealm focused on isolation without direct interaction with external resources or the DOM, the inclusion of postMessage would depend on clearly defined use cases that justify its need while ensuring that confidentiality and isolation are not compromised.

### Web Socket APIs

#### Use Cases and Functionality

WebSocket provides full-duplex communication channels over a single, long-lived connection. It is widely used for real-time web applications, enabling efficient, bidirectional communication between a client and a server.

#### Confidentiality and Isolation

WebSocket connections could allow scripts within a ShadowRealm to establish direct communication with external servers, bypassing the realm's isolation constraints. This capability raises significant confidentiality concerns because it can potentially expose the ShadowRealm to external data and allow for the exfiltration of information from the isolated environment.

While WebSocket does not inherently expose additional information from the external world into the ShadowRealm (beyond the explicit communication initiated by the WebSocket connection itself), the ability to send and receive messages from external servers could be leveraged to infer information about the external environment or to leak details about the isolated code's execution.

#### Security Considerations

Including WebSocket in ShadowRealm introduces potential challenges. It would require robust mechanisms to ensure that the connections do not compromise the confidentiality and integrity of the isolated environment or the broader application.
The real-time, bidirectional nature of WebSocket communications could also introduce new vectors for attacks if not properly isolated and secured within the context of ShadowRealm.

#### Conclusion

Given the primary goals of ShadowRealm to provide an isolated execution environment with a focus on maintaining confidentiality, the inclusion of WebSocket would necessitate careful consideration. Thus, unless there are compelling use cases that cannot be addressed through other, more isolated means, and unless there are robust safeguards to prevent abuse, WebSocket might be more appropriately excluded from the initial API set within ShadowRealm to maintain the strict isolation and confidentiality objectives.

### setTimeout & co APIs

#### Use Cases and Functionality

setTimeout is a fundamental Web API used to execute a function or a specified piece of code once after the timeout expires. It's crucial for delaying tasks or creating asynchronous behavior in JavaScript environments.

#### Confidentiality and Isolation

The use of setTimeout within a ShadowRealm does not inherently compromise confidentiality or isolation. It allows for time-based execution control but does not provide access to external information or the broader execution context outside the ShadowRealm.

While setTimeout could potentially be used in conjunction with other APIs to create timing attacks or to infer information based on execution timing, this concern is not unique to ShadowRealm and is a broader issue across web security contexts.
Security Considerations

Inclusion of setTimeout in ShadowRealm is not considered a risk in terms of confidentiality or isolation. However, any API capable of timing could theoretically be used as part of a side-channel attack to infer information based on execution time differences. The risk is mitigated by the fact that ShadowRealm is not intended as a strong security boundary against such attacks.

#### Conclusion

Given its fundamental role in JavaScript execution and the lack of direct confidentiality or isolation breaches, setTimeout appears to be a suitable candidate for inclusion in ShadowRealm. It enables essential programming patterns and functionalities that are likely to be needed within the isolated code environments that ShadowRealm aims to support. The potential security concerns related to timing attacks are acknowledged but are not sufficient to warrant exclusion, especially considering the broader context in which ShadowRealm operates and its intended use cases.

### crypto API

#### Use Cases and Functionality

The Web Cryptography API provides cryptographic operations in web applications, such as hashing, signature generation and verification, encryption and decryption. It's crucial for secure communication, data protection, and authentication processes.

#### Confidentiality and Isolation

Including the crypto API within a ShadowRealm aligns well with the goals of confidentiality and isolation. Cryptographic operations do not inherently expose sensitive information to the external environment or compromise the isolation of the ShadowRealm. Instead, they enhance the ability to maintain data integrity and confidentiality within the realm by enabling secure data handling practices.

The crypto API does not provide information about the user's environment or allow for data exfiltration, making it a good fit for the isolated execution context of ShadowRealm.
Security Considerations

The crypto API is designed with security in mind, offering low-level cryptographic primitives that can be used to build secure applications. Its inclusion in ShadowRealm would not introduce security vulnerabilities but rather provide tools for enhancing security within the isolated environment.

Given the importance of cryptographic operations in modern web applications, the availability of the crypto API within ShadowRealm could facilitate a wide range of secure operations, from generating cryptographic keys in isolation to encrypting sensitive data before it leaves the realm.

#### Conclusion

The Web Cryptography API (crypto) appears to be a suitable candidate for inclusion in ShadowRealm due to its focus on security and its compatibility with the goals of isolation and confidentiality. It provides essential capabilities for secure data handling that are likely to be beneficial within the context of isolated code execution, without compromising the integrity or confidentiality of the ShadowRealm or the wider application.

### Canvas APIs

#### Use Cases and Functionality

The Canvas API enables drawing graphics and animations on a web page. It's powerful for creating visual content dynamically, including games, graphs, and interactive media. In the context of ShadowRealm, the use cases could theoretically include offscreen rendering or computation of visual elements before introducing them into the main document, although both realms share the same process.

#### Confidentiality and Isolation

While the Canvas API itself does not directly access or expose user data, it can be used in ways that potentially leak information about the user's environment. For example, the nuances of how graphics are rendered could be analyzed to infer system characteristics or to perform browser fingerprinting.

#### Considerations

Callable Boundary: The callable boundary in ShadowRealm prohibits direct object sharing between realms. This limitation means that any object created by the Canvas API inside a ShadowRealm cannot be directly passed to the main realm. This significantly restricts the utility of such APIs within a ShadowRealm since objects like CanvasRenderingContext2D or CanvasGradient cannot be utilized outside of their creation context.

Indirect Information Leakage: Although Canvas API objects don't hold sensitive information, the precise behavior and performance characteristics of these APIs could indirectly reveal information about the user's device or browser settings

#### Conclusion

Given the callable boundary's limitations and the potential for indirect information leakage, the Canvas API family does not seem suitable for inclusion in ShadowRealm at this stage. The inability to share complex objects like CanvasGradient across realms, combined with the confidentiality and isolation goals of ShadowRealm, means that the benefits of including these APIs are outweighed by the potential risks and limitations.

### navigator API

#### Use Cases and Functionality

The navigator object provides information about the user's browser and operating system, including details such as the browser version, the user's preferred language, and network connectivity status. While some functionalities exposed by navigator, such as language settings or online status, might be considered harmless and potentially useful within a ShadowRealm, other features could expose too much information about the user's environment or be used to fingerprint the user.

#### Confidentiality and Isolation

Including navigator within a ShadowRealm raises concerns regarding confidentiality and the potential for information leakage. Features like userAgent, platform, plugins, and others can be used to gather detailed information about the user's environment, leading to privacy issues and potentially violating the confidentiality principle of ShadowRealm. The exposure of such information could make it easier to identify or track users across different sessions or websites, which is contrary to the goals of creating isolated execution environments.

#### Considerations

Selective Exposure: If any navigator properties or methods are deemed necessary for specific use cases within a ShadowRealm, a careful, selective approach should be taken. Only features that do not compromise user privacy or security should be considered, and even then, their inclusion should be critically evaluated against the potential risks.

Privacy Implications: The inclusion of navigator or any of its more revealing properties could inadvertently facilitate user fingerprinting or tracking, undermining the privacy protections that ShadowRealm aims to uphold.

#### Conclusion

Given the potential for information leakage and the privacy concerns associated with exposing the navigator object or its properties within a ShadowRealm, it is advisable to exclude it, or at the very least, severely limit its exposure. Any decision to include specific navigator features should be made with caution, prioritizing user privacy and the confidentiality of the execution environment. The default stance should lean towards exclusion unless a compelling, safe use case necessitates its inclusion, ensuring that ShadowRealm remains a secure and isolated environment.

### structuredClone API

#### Use Cases and Functionality

Within the ShadowRealm, structuredClone can be useful for duplicating complex data structures that are created or consumed internally. This includes cloning objects, arrays, maps, sets, dates, and other structured data that may not serialize/deserialize cleanly with JSON due to its limitations (e.g., handling of Date objects, Map, Set, functions, etc.). This utility supports use cases where deep cloning of objects is necessary without the intention to transfer them across the callable boundary.

#### Confidentiality and Isolation

structuredClone does not inherently violate confidentiality or isolation within the ShadowRealm. Since the operation and its output are confined to the internal context of the ShadowRealm, it doesn't introduce additional risks of information leakage or compromise confidentiality. The cloned objects remain within the isolated execution environment, ensuring that the process does not expose sensitive data to the outer realm or other execution contexts.

#### Considerations

While structuredClone can enhance the ShadowRealm's capabilities by enabling complex data manipulations, its current inability to transfer cloned objects across the callable boundary limits its utility for inter-realm communications. However, this limitation does not diminish its value for internal use cases within the ShadowRealm. Future enhancements that allow structuredClone to work in conjunction with an expanded callable boundary could further increase its utility, enabling seamless and secure data exchange between realms.

#### Conclusion

Despite the current limitations regarding cross-realm data transfer, structuredClone remains a valuable API for ShadowRealm's internal use. It enhances data handling capabilities by allowing deep cloning of complex structures without risking confidentiality or isolation. Future proposals to integrate structuredClone with an extended callable boundary could unlock additional use cases, making it an even more powerful tool for developers working within the ShadowRealm context.

### console API

#### Use Cases and Functionality

Purpose: The console API is primarily used for debugging purposes, allowing developers to log information, warnings, errors, and other messages to the browser's console. This capability is crucial for development and debugging, providing insights into the execution flow and state of the application.

ShadowRealm Context: Within a ShadowRealm, having access to console would allow developers to debug scripts executed in this isolated environment. This can significantly ease the development and troubleshooting process for code running within the ShadowRealm.

#### Confidentiality and Isolation

Information Leakage: While the console API itself does not directly leak information between realms, its misuse can inadvertently expose sensitive data to the console, which might be considered a confidentiality concern. However, this risk is primarily associated with how developers choose to use the console rather than an inherent vulnerability of the API.

Isolation Integrity: Providing a console API within the ShadowRealm does not compromise the isolation from the main realm, as it does not facilitate direct communication or data sharing between the realms. The output is directed to the developer's console, which is a common practice across various execution contexts.

#### Considerations

Debugging Utility vs. Potential Misuse: The key consideration is balancing the utility of console for debugging with the potential for misuse. While console logs can greatly aid in development, ensuring that developers are aware of the implications of logging sensitive information is crucial.

#### Conclusion

Given its indispensable role in debugging and the lack of direct confidentiality or isolation risks, the console API should be considered for inclusion within the ShadowRealm.

### Web Worker APIs

#### Use Cases and Functionality

Purpose: Web Workers allow background script execution, enhancing web app performance by offloading tasks without freezing the UI.

ShadowRealm Context: They could let isolated scripts in ShadowRealms perform complex tasks in parallel, improving versatility.

#### Confidentiality and Isolation

Information Leakage: The main concern is potential information leakage due to Web Workers' ability to communicate with the main thread, which could lead to unintended data exposure.

Isolation Integrity: Maintaining ShadowRealm's isolation requires strict control over Web Workers' instantiation and communication, ensuring sensitive information isn't inadvertently transferred.

#### Considerations

Implementation Complexity vs. Use Case Justification: Implementing Web Workers in ShadowRealms introduces complexity and necessitates clear use cases to justify their inclusion, balancing parallel execution benefits against confidentiality risks.

#### Conclusion

Web Workers could be considered in the future for inclusion in ShadowRealms with strict controls on their use and communication to prevent leaks and maintain isolation. The decision should be driven by demonstrated needs for background processing within the isolated environment.

### performance API

#### Use Cases and Functionality

Purpose: The Performance API offers insights into the performance and memory usage of web applications. These insights are crucial for developers aiming to optimize their applications for better efficiency and user experience.

#### Confidentiality and Isolation

Specific Concerns: While performance insights are valuable, certain methods like `measureUserAgentSpecificMemory` provide highly detailed information, including bytes used, breakdown by type (e.g., DOM, JS), and attribution to specific URLs and containers. Such detailed information could potentially leak sensitive data about the execution environment and the resources it uses, undermining the isolation intended with ShadowRealm.

#### Considerations

Risk vs. Benefit: The detailed memory usage data, especially URLs and container attributions, might not be necessary for performance optimization within the isolated environment of ShadowRealm. The risk of exposing sensitive information may outweigh the benefits of having such detailed insights available.

#### Conclusion

Recommendation: To maintain the confidentiality and isolation integrity of ShadowRealm, it is recommended to exclude it and work on limitting access to specific Performance API methods like `measureUserAgentSpecificMemory` that provide highly detailed environmental and resource-related information. The focus should instead be on offering essential performance insights that align with the use cases of ShadowRealm without risking unnecessary information disclosure.
